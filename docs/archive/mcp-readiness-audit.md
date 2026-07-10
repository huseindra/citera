# MCP Readiness Audit

**Date:** 2026-07-10 · **Scope:** whole platform (engine, REST, SDK, MCP, auth, ops)
**Method:** production architecture review — challenge every layer, assume nothing is correct.

> **Honest framing.** An MCP server (`packages/mcp`, v0.1) already exists: the
> chain `Claude → MCP tools → @citera/sdk → REST /v1 → Review Engine` is
> implemented, live-smoke-tested against Claude Opus 4.8 + Voyage, and merged.
> This audit therefore answers a sharper question: **is the platform behind
> that MCP server production-ready, and where does v0.1 cut corners?**
> Findings below marked ✅ exist today; marked ⚠️ are gaps.

---

## Executive Summary

**Overall MCP readiness: Ready for local/hackathon use · Minor Refactor for a
hosted single-tenant deployment · Major Refactor for multi-tenant production.**

The architecture is fundamentally sound for MCP because the hard invariants
were built into the engine, not the transports:

1. **Business logic exists exactly once.** The Review Engine (retrieve →
   evaluate → ground → persist) is the only place findings are produced.
   REST serves it, the SDK wraps REST, MCP wraps the SDK. Coverage/readiness
   was recently moved from the web client into the API (`services/coverage.py`),
   closing the last logic-duplication seam.
2. **The dangerous surfaces are already fenced.** Retrieval scores, embeddings,
   and evaluation prompts never cross the `/v1` boundary in reviewer-facing
   shapes; the MCP layer cannot leak what REST does not serve.
3. **Async review execution with per-rule commits** means polling clients
   (SDK `waitUntilComplete`, the Playground, MCP) already observe progress.

The material gaps are operational, not architectural: **API-key enforcement is
absent** (keys are minted, SHA-256-hashed, rotatable — and never checked),
**review jobs run in-process** (a crashed server strands reviews in `running`
forever), **no pagination**, **no enforced rate limits**, and the composite
`review_documents` MCP tool **blocks 1–3 minutes inside a single tool call**,
which will exceed default client timeouts in some MCP hosts.

None of these require a rewrite. The priority matrix below sequences ~9–13
engineer-days of refactors, of which only ~2 days (auth enforcement + tool
timeout mitigation) block exposing the MCP server beyond localhost.

---

## Architecture Assessment

Target topology (required):

```
Claude → MCP tools → SDK → REST → Review Engine
```

Actual topology (verified in code):

| Layer | Location | Verdict |
|---|---|---|
| Review Engine | `apps/api/app/services/review.py` + `citera_pipeline` + `citera_rulesets` | ✅ single source of truth; jurisdiction-agnostic; per-rule isolation; append-only audit |
| REST | `apps/api/app/routers/*` under `/v1` | ✅ canonical; ⚠️ also mounted bare (unversioned) for the Playground — drift risk |
| SDK | `packages/sdk` (`@citera/sdk`) | ✅ thin typed transport, zero deps, no business logic |
| MCP | `packages/mcp` (`@citera/mcp`) | ✅ thin adapter over the SDK; never calls REST directly; never re-scores |
| Playground | `apps/web` | ✅ consumes the same REST; ⚠️ still computes coverage locally in `lib/coverage.ts` (duplicate of the server formula — display-only, but two copies of one formula is one too many) |

**Layering violations found: none.** The MCP server imports only `@citera/sdk`
and Node stdlib. The SDK contains no regulatory vocabulary beyond type names.
Grep-verified: no MCP → REST bypass, no SDK-side evaluation, no client-side
grounding.

**One deliberate asymmetry to keep:** `/retrieval/query` is mounted bare but
*excluded* from `/v1` — correct, since its response carries dense/sparse/fused
scores that must never reach reviewer-facing consumers.

---

## Tool Design Audit

| Expected tool | Status | Notes |
|---|---|---|
| `review_documents` | ✅ exists | Composite: upload ×2 → wait ready → create review → wait complete → report. ⚠️ blocks 1–3 min in one call — see State Audit |
| `list_findings` | ✅ exists | Groups by impact (Critical/Medium/Low), includes readiness — good Claude ergonomics |
| `get_finding` | ✅ exists | Single-argument (`finding_id`) thanks to the purpose-built `GET /v1/findings/{id}` dossier endpoint — the right call; no session state needed in the MCP server |
| `list_rulesets` | ✅ exists | Grouped by status; aliases included so Claude can pass `"fda"` |
| `export_report` | ✅ exists | markdown/json real; **pdf honestly returns the print-ready page link** rather than faking generation |

**Required API changes for the tool set: none remaining.** The two endpoints
MCP needed (finding dossier, report with server-side readiness) were added
when the server was built; the tools required zero wrapper logic beyond
reshaping JSON.

**Should NEVER become tools:**

- `POST /retrieval/query` — leaks retrieval scores; violates the product rule.
- `GET …/findings/{id}/audit` (raw records) — payloads include
  `evaluate.prompt` bodies. Serving raw prompts into a Claude conversation
  breaks the "never expose prompts" rule. `get_finding` correctly returns only
  an audit *status* (span_verified, record count). Keep it that way.
- Key management (`/keys*`) — credentials do not belong in a model-facing tool.
- `GET /documents/{id}/text` — not dangerous, but dumping a full protocol into
  context is rarely what the user wants; the dossier's verified quote + span
  is the right granularity. Revisit only if a `quote_context` tool is needed.

**Missing tool worth adding (P2):** `get_review_status(review_id)` — cheap
progress probe (status + findings-so-far count) to support the async pattern
below.

---

## Resource Audit

| Object | First-class? | Evidence |
|---|---|---|
| Document | ✅ | `POST/GET /v1/documents`, id-addressable, status lifecycle (`processing→ready/failed`), content-hash idempotent upload |
| Review | ✅ | create/get/list, status lifecycle, owns findings |
| Finding | ✅ (recent) | Now id-addressable via `/v1/findings/{id}`; previously only embedded in Review |
| Ruleset | ✅ | Registry + detail; versioned, self-describing packs; status gate |
| Report | ✅ (recent) | Projection resource: `GET /v1/reviews/{id}/report` — correctly derived, not stored |
| Evidence | ◐ sub-resource | Lives inside Finding (quote/span/strength) + separate evidence endpoint for the drawer. Correct — evidence has no identity independent of its finding. No change needed |
| Audit Trail | ◐ intentionally internal | Append-only records exist and are id-addressable per finding, but only status is exposed outward. Correct for MCP; full trail stays a Playground/compliance surface |

**Recommendation:** no resource remodeling. Optionally, MCP *resources*
(the protocol primitive, distinct from tools) could expose completed reviews
as `citera://review/{id}` for context attachment — a nice-to-have, not
readiness-relevant.

---

## SDK Audit

- **Encapsulates business logic?** No — and that is correct. It moves bytes,
  types responses, and polls. Zero regulatory decisions.
- **Only a transport wrapper?** Yes. `Http` class + four resource namespaces.
- **Leaks REST implementation?** Minor and deliberate: field names mirror the
  wire (`rule_id`, `verbatim_quote`). Param names are ergonomized
  (`document`/`protocol` → `document_id`/`protocol_document_id`). Acceptable;
  renaming now would break the published examples.
- **Suitable for MCP wrapping?** Proven — the MCP server is 100 % SDK calls.

**Gaps (all minor):**
1. ⚠️ No retry/backoff on transient failures (fetch throws raw on ECONNREFUSED;
   429 handling absent — relevant once rate limits are enforced).
2. ⚠️ `waitUntilComplete` polls at fixed 2 s; fine locally, chatty hosted.
   Add jittered backoff.
3. ⚠️ No `AbortSignal` support for cancellation.
4. No tests of its own (exercised indirectly via the MCP smoke). Add a small
   contract test against the FastAPI app.

---

## API Audit

| Aspect | State | Verdict |
|---|---|---|
| Naming | Consistent snake_case wire; `ruleset` vs legacy `ruleset_id` both accepted (documented) | ✅ |
| Versioning | `/v1` mounted; ⚠️ same routers also mounted bare for the web app. Two names for every route = drift risk. Freeze: bare = internal/Playground only, never documented | Minor |
| Request models | Pydantic, typed, defaulted | ✅ |
| Response models | Pydantic; timestamps now explicit UTC (the "+420 min duration" bug is fixed at this layer with a regression test) | ✅ |
| Error responses | Correct status codes (404/409/413/415/422), human-readable `detail` strings; ⚠️ no machine-readable error codes. MCP tolerates this (errors become text), SDKs would benefit from `{code, detail}` | Minor |
| Pagination | ⚠️ none on `/documents`, `/reviews`. Unbounded lists; fine at demo scale, required before any hosted use | Minor |
| Long-running jobs | `202 Accepted` + status polling; per-rule commits make polls meaningful | ✅ pattern, ⚠️ execution (see State) |
| Polling | Exists at both SDK and Playground; document readiness also polled | ✅ |
| Streaming | None (see State Audit) | Gap |
| Rate limiting | ⚠️ advertised (60 RPM on the plan) but **not enforced** — an honesty bug as much as an ops one | Minor |
| Idempotency | Documents: ✅ content-hash dedupe (same bytes → same id, 200 vs 201). Reviews: ⚠️ every POST spawns a fresh run — a retried request double-spends credits. Add optional `Idempotency-Key` or dedupe on (document, protocol, ruleset, version) with an explicit `force` | Minor |

**Would MCP require API redesign? No.** It already runs on this API. The items
above are hardening, not redesign.

---

## State Audit

**Synchronous:** ruleset registry/detail, finding dossier, report export,
document metadata.
**Asynchronous:** document ingestion (chunk+embed in background),
review execution (retrieve+evaluate per rule in background).

**The one real architectural weakness in the platform:**

> ⚠️ **Reviews run via FastAPI `BackgroundTasks` — in-process, non-durable.**
> A crash or restart mid-review strands the row in `running` forever (no
> lease, no timeout, no resume). Horizontal scaling is impossible (the task
> lives in one worker's event loop). At hackathon scale this is fine; it is
> the first thing to replace for production (job table + worker loop, or
> arq/Celery — the per-rule commit design already makes resume cheap: skip
> rules that have findings).

**Should review execution become an MCP long-running task?** Yes — in
semantics, not necessarily in protocol machinery:

- v0.1's `review_documents` hides the 1–3 min pipeline inside one blocking
  tool call. Our smoke client sets a 10-min timeout; **Claude Desktop and
  other hosts may not** (60 s defaults are common). This is the top Claude-UX
  risk.
- Mitigations, cheapest first: (1) emit **MCP progress notifications**
  (`notifications/progress`) from the tool while polling — keeps the
  single-call UX and resets host timeouts; (2) offer a split flow
  (`start_review` → `get_review_status` → `list_findings`) as a fallback;
  (3) SSE streaming from REST is **not** required for either.

**Would streaming improve UX?** Marginally, and only for finding-by-finding
reveal in the Playground (it already fakes this well via polling + per-rule
commits). Not an MCP blocker; do not build SSE for MCP's sake.

---

## Authentication Audit

Current state, verified: `ApiKey` model with real generation, SHA-256 hash
storage, prefix display, rotate/revoke lifecycle, shown-once secret. The SDK
sends `Authorization: Bearer`. **No endpoint verifies anything** — the
`main.py` comment says "key enforcement on /v1 is a fast-follow", and it still
is.

- **Are API keys alone sufficient for MCP?** Yes. MCP servers configured via
  `env: {CITERA_API_KEY}` in the client config is the established pattern for
  key-authed backends. Local stdio transport additionally inherits process
  isolation.
- **Is OAuth eventually required?** Only when two things happen together:
  hosted multi-tenant deployment + remote (HTTP) MCP transport. Then MCP's
  OAuth 2.1 authorization flow becomes relevant. **Not now** (per audit
  instructions, and correctly so).
- **What must happen before ANY non-localhost exposure:** a `Depends`
  dependency on `/v1` that hashes the presented bearer and matches
  `api_keys.key_hash` (+ revoked check). ~½ day including tests, because the
  storage side already exists. Ship with an env kill-switch
  (`AUTH_ENFORCE=false` default locally) so the hackathon demo stays
  friction-free.

---

## Claude UX Audit

The audited conversational flow:

```
"Review this protocol against FDA."        → review_documents()   ✅ works today
"Show me the critical findings."           → list_findings()      ✅ grouped by impact
"Explain Finding #2."                      → get_finding()        ◐ see below
"Export the report."                       → export_report()      ✅ markdown/json/pdf-link
```

Verified end-to-end in the live smoke (reproduced the demo answer key through
the real stdio transport). The boundaries are **domain-shaped, not
HTTP-shaped** — Claude never sees endpoints, uploads, or polling.

Friction points, in priority order:

1. ⚠️ **Tool-call duration** (see State Audit) — the only likely demo-day
   failure mode. Progress notifications are the fix.
2. ◐ **"Finding #2" is not addressable.** Tools speak UUIDs; users speak
   ordinals. Add a stable `index` field to `list_findings` output so Claude
   can resolve "Finding #2" without guessing. (Prompt-level nicety, ~1 h.)
3. ◐ `review_documents` accepts text/paths but not URLs; fine for now, note
   for a future `protocol_url` argument.
4. ✅ Error texts (`isError` + API detail strings) read well in conversation —
   e.g. the 422 for an in-development ruleset explains *why* it cannot run.

---

## Readiness Score

| Category | Score | Rationale |
|---|---|---|
| Review Engine | **Ready** | Single source of truth, per-rule isolation, audit log, grounding gate; no MCP-driven changes needed |
| REST API | **Minor Refactor** | Auth enforcement, pagination, rate-limit enforcement, error codes, freeze dual mounting |
| SDK | **Ready** (minor polish) | Thin, typed, proven under MCP; add retry/backoff + tests |
| Resources | **Ready** | All seven objects correctly modeled; recent findings/report endpoints closed the gaps |
| Tool Design | **Minor Refactor** | 5/5 tools exist and map cleanly; fix long-call timeout exposure, add ordinals + status probe |
| Authentication | **Minor Refactor** (mechanism) / **Major** (posture) | Storage/lifecycle done; enforcement entirely absent — small code, big gate |
| Scalability | **Major Refactor** (for production) | In-process jobs, no durability, no horizontal scale, unbounded lists — irrelevant at demo scale, disqualifying at production scale |
| Streaming | **Not Ready** (and mostly unneeded) | No SSE anywhere; MCP progress notifications are the only streaming worth building |
| Developer Experience | **Ready** | Reference docs, SDK + MCP READMEs, sample corpus, honest plan limits |
| Claude UX | **Ready** (with the timeout caveat) | Natural flow proven live; 2 small ergonomics items |
| **Overall** | **Ready (local/demo) · Minor Refactor (hosted single-tenant) · Major Refactor (multi-tenant prod)** | |

---

## Strengths

1. Layering is real, not aspirational — verified no bypasses in any direction.
2. Evidence discipline extends across transports: what REST refuses to serve,
   MCP cannot leak (scores, prompts, embeddings).
3. Async-with-visible-progress was designed in (per-rule commits), which is
   exactly the shape MCP long-running semantics want.
4. Honest failure modes everywhere: `evaluation_failed` findings, 422 for
   non-runnable rulesets, pdf-as-link instead of fake generation.
5. Idempotent document ingestion by content hash.

## Weaknesses

1. Auth enforcement absent (issued keys are decorative).
2. Non-durable in-process job execution; stranded-`running` on crash.
3. Blocking 1–3 min MCP tool call with no progress signal.
4. No pagination / enforced rate limits; unbounded list endpoints.
5. Review creation is not idempotent (retry = double spend).
6. Coverage formula duplicated (server `coverage.py` + web `coverage.ts`).
7. Dual-mounted routers (bare + `/v1`) invite surface drift.
8. Errors lack machine-readable codes.

---

## Recommended Refactors (minimal set — no rewrites)

| # | Refactor | Layer | Effort |
|---|---|---|---|
| R1 | Bearer-key verification dependency on `/v1` (env-gated), 401/403 paths, tests | REST | 0.5 d |
| R2 | MCP progress notifications in `review_documents`; keep single-call UX | MCP | 0.5 d |
| R3 | `get_review_status` tool + `index` ordinals in `list_findings` | MCP | 0.5 d |
| R4 | Review idempotency: dedupe on (doc, protocol, ruleset, version) + `force` | REST | 0.5 d |
| R5 | `limit/offset` (or cursor) on `/documents`, `/reviews` + SDK params | REST+SDK | 1 d |
| R6 | Durable review jobs: `status='queued'` rows + worker loop with lease/timeout; resume skips completed rules | Engine/ops | 2–3 d |
| R7 | Enforce plan rate limits (simple token bucket keyed by api key) | REST | 1 d |
| R8 | SDK retry/backoff (429/5xx), poll jitter, AbortSignal; contract tests | SDK | 1 d |
| R9 | Web consumes `/report` coverage; delete duplicate formula in `coverage.ts` (keep the pure-fn tests against API fixtures) | Web | 1 d |
| R10 | Structured error envelope `{code, detail}` (additive, keep `detail`) | REST | 1 d |

## Priority Matrix

|  | **Low effort** | **High effort** |
|---|---|---|
| **Blocks non-local MCP** | R1 auth · R2 progress | — |
| **High value, not blocking** | R3 status tool · R4 idempotency | R6 durable jobs |
| **Hosted-scale hygiene** | R5 pagination · R7 rate limits | R8 SDK hardening |
| **Debt / polish** | R10 error codes | R9 coverage dedupe |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| MCP host kills the 1–3 min `review_documents` call | **High** on non-tuned hosts | Demo-fatal | R2 now; instruct judges' client timeout as stopgap |
| Server restart strands `running` reviews | Medium | Confusing state, manual DB fix | R6; interim: startup sweep marking stale `running` → `failed` (1 h) |
| Unauthenticated API exposed beyond localhost by accident | Medium | Full data access | R1; until then bind to localhost only |
| Retried review double-spends credits | Medium | Cost/trust | R4 |
| Bare vs `/v1` drift | Low now, compounding | Silent contract break | Freeze policy in CLAUDE.md + reference only `/v1` |
| Prompt leakage via future "audit" tool | Low | Violates core product rule | Documented "never-tool" list above |

## Implementation Roadmap

- **Phase 0 — before any external demo (1 day):** R1 + R2, plus the 1-hour
  stale-`running` startup sweep.
- **Phase 1 — MCP polish (1 day):** R3 + R4.
- **Phase 2 — hosted single-tenant (3–4 days):** R5 + R7 + R8 + R10.
- **Phase 3 — production posture (3–4 days):** R6 + R9; revisit OAuth only if
  a remote HTTP MCP transport ships.

**Total estimated effort: ~9–13 engineer-days**, of which **~1 day (Phase 0)
is the true readiness gate** for exposing the existing MCP server beyond a
local demo. No layer requires a rewrite; the topology Claude needs is the
topology that exists.
