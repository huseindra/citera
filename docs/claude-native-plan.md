# Claude-Native Hard Revise — Implementation Plan

**Date:** 2026-07-10 · **Scope:** one focused day · **Code:** none yet (plan only)

## The reframe, in one sentence

> **Claude generates regulatory documents. Citera proves whether Claude is right.**

Citera stops being "an AI reviewer with an MCP port" and becomes the
**Clinical Regulatory Verification Engine** — the trust layer that lets Claude
safely do regulatory work. Claude is the actor; Citera is the verifier.

```
Claude writes → Citera verifies → fails → Claude revises → Citera verifies → passes → Submission Ready
```

Nothing about the engine changes philosophically — it already refuses to show
unverifiable claims. What changes is **who proposes**: today the engine judges
static documents; tomorrow it judges *Claude's drafts, iteratively*. The
grounding gate becomes the reason Claude can be trusted in this domain at all.

---

## 1. Existing components that can be reused (inventory, verified in code)

| Component | Where | Reused for |
|---|---|---|
| Per-rule evaluation (retrieve → evaluate → ground) | `app/services/review.py` + `citera_pipeline` | The verification core — identical judgment path, scoped to one rule |
| Protocol already ingested + embedded | `documents` + `chunks` (pgvector) | Loop iterations re-verify against the SAME protocol — **zero re-ingestion, zero re-embedding per iteration** (embeddings cached) |
| Span-grounding gate | `citera_pipeline.findings.ground_quote` | Grounds quotes against the *revised text string* — works on any canonical text, not just stored documents |
| Rule packs w/ `description`, `statutory_refs`, `remediation` | `citera_rulesets` | `explain_failure` content: requirement, citation, suggested direction |
| Suggested revision (opt-in prompt + strict tool field) | evaluator | Claude's starting draft in the loop |
| Report + server-side readiness | `GET /v1/reviews/{id}/report`, `services/coverage.py` | `prepare_submission` verdict, coverage, findings by impact |
| Finding dossier by id | `GET /v1/findings/{id}` | `explain_failure` payload |
| Append-only audit log | `AuditRecord` | Every verification attempt recorded — the loop itself becomes auditable ("Claude's 2nd draft rejected at 14:03, 3rd verified at 14:05") |
| ScriptedEvaluator + conftest isolation | tests | Deterministic loop tests without live API |
| `@citera/sdk` + `@citera/mcp` | packages | One new SDK method; tools renamed/reshaped in place |

**The only genuinely missing piece:** an engine entrypoint that evaluates
**one rule against candidate text** instead of all rules against a stored
document. Everything else is reshaping and renaming.

---

## 2. The Verify Loop — design

### New service: `verify_revision` (`app/services/verification.py`)

```
Input:  finding_id  (anchors rule + review + protocol + original evidence)
        revised_text (Claude's candidate consent language)
Steps:  1. resolve finding → rule, ruleset version, protocol_document_id
        2. hybrid_search(rule.retrieval_queries, protocol chunks)   ← cached embeddings, ~fast
        3. evaluator.evaluate(rule, target=revised_text, protocol_evidence)  ← ONE Claude call
        4. ground quotes byte-for-byte against revised_text          ← same gate, same honesty
        5. append AuditRecord step="verify.revision"
           payload={finding_id, rule_id, status, revised_text_hash, reasoning}
Output: verdict: "verified" | "rejected"
        status (satisfied|partial|conflicting|not_found)
        requirement {citation, title, description, remediation}
        reasoning (why it fails / why it passes)
        verified_quote + span (grounded in the revision when evidence-backed)
```

Latency per iteration: **~5–15 s** (one retrieval on cached embeddings + one
Opus call). Loop of 3 iterations fits comfortably in a live demo. Compare:
re-reviewing a whole document = 1–3 min per iteration — unusable. This is why
the targeted entrypoint matters.

**Verdict mapping (honest, no new judgment logic):** `satisfied` → verified;
anything else → rejected, with the engine's own status + reasoning as the
structured explanation. The evaluator, prompts, and grounding are UNCHANGED —
verification inherits the exact judgment path the packs were validated on.

### Persistence & the overlay

Verifications are audit records, not mutations — the original review stays
immutable (regulatory posture: you never rewrite history). `prepare_submission`
computes readiness as: base review findings **overlaid** with the latest
`verify.revision` verdict per finding. A finding whose latest verification is
`verified` counts as satisfied-by-revision and is labeled exactly that —
"resolved by verified revision," never silently upgraded.

### REST (canonical layer — MCP never bypasses)

- `POST /v1/findings/{finding_id}/verify` `{revised_text}` → VerificationOut
- `GET /v1/reviews/{id}/submission` → report + overlay + remaining actions
  (remediation of still-failing rules) + final verdict
  (`Submission Ready` / `Not Ready — N critical findings`)

SDK: `citera.findings.verify(findingId, revisedText)`,
`citera.reviews.submission(reviewId)` — thin, like everything else.

---

## 3. MCP tools — redesign (challenge every existing tool)

| Today | Verdict | Becomes |
|---|---|---|
| `review_documents` | Sound capability, transport-flavored name; blocks 1–3 min silently | **`verify_consent`** — same implementation + **MCP progress notifications** while polling ("Verifying requirement 5/8…"). Output language: *verification results*, *submission readiness* |
| `get_finding` | Dossier dump — API wrapper smell | **`explain_failure`** — reshaped: Requirement → Evidence → Why it fails → Suggested direction (rule.remediation + suggested_revision). Ordered for an actor deciding what to write next, not a reader browsing |
| `list_findings` | Fine — already domain-shaped (impact groups + readiness) | Keep name; add stable `index` ordinals so "fix finding #2" resolves; add per-finding `verification` overlay status |
| `export_report` | CRUD-flavored | **`generate_regulatory_brief`** — same markdown report, reframed as the artifact you attach to a submission |
| `list_rulesets` | Fine | Keep |
| — | missing | **`verify_revision`** *(the centerpiece)* — finding_id + revised_text → Verified/Rejected + which regulation still fails + what evidence is missing |
| — | missing | **`prepare_submission`** — review_id → readiness (with overlay), critical/major findings, remaining actions, final verdict |

Seven tools, every one phrased as something Claude can *do*. No CRUD verbs, no
REST semantics, no pagination artifacts. Tool descriptions rewritten in
actor-verifier language ("Verify the consent language you just drafted…").

**What we deliberately do NOT build:** `verify_protocol` / `verify_claim` /
free-standing claim checking — the engine has no validated judgment path for
arbitrary claims, and faking one violates the product's core rule. The spec's
tool list is a direction, not a checklist; we ship only capabilities the
engine actually has.

---

## 4. Language reframe (zero-risk, high-perception)

Applied to MCP tool descriptions, tool outputs, and the report header — the
surfaces judges actually read during the demo:

| Old | New |
|---|---|
| AI-powered regulatory review | Evidence-backed regulatory verification |
| Review Engine | Verification Engine |
| Review results | Verification results |
| Review complete | Submission Ready / Not Ready |

Homepage/Playground copy: **explicitly out of scope** (per the brief — the
problem is the story, not the UI). One exception if time allows: the two
strings "Review Engine" in the architecture diagram → "Verification Engine"
(5-minute copy edit, no layout change).

---

## 5. Backend / frontend change list

**Backend (the real work):**
1. `services/verification.py` — targeted single-rule evaluation against
   candidate text (reuses retrieval/evaluator/grounding). **~3 h incl. scripted tests**
2. `POST /v1/findings/{id}/verify` + `GET /v1/reviews/{id}/submission`
   (overlay + remaining actions). **~2 h incl. tests**
3. Audit step `verify.revision` + overlay query. **folded into 1–2**

**SDK:** two methods + types. **~30 min**

**MCP:** rename 3 tools, reshape `explain_failure`, add `verify_revision` +
`prepare_submission`, progress notifications on `verify_consent`, rewrite all
descriptions in actor-verifier language. **~2.5 h**

**Frontend: none required.** The loop lives in Claude. (Optional later:
verification attempts shown in the Playground dossier timeline — not for
demo day.)

**Validation:** extend the live smoke — draft-fails → revise → verified →
prepare_submission flips verdict. **~1 h**

**Total: ~9 hours. Fits one focused day.** Priority order if time compresses:
verify_revision service+endpoint → MCP verify_revision + explain_failure →
prepare_submission → renames/language → progress notifications.

---

## 6. Demo script (3:00 — the loop is the whole show)

Cut entirely: homepage, API keys, SDK code, REST, architecture, auth.

- **0:00–0:20 — Hook.** "LLMs will happily write you a compliant-sounding
  consent form. In this industry, *compliant-sounding* gets studies suspended.
  Citera's engine is not allowed to show anything it cannot prove."
- **0:20–0:55 — The problem, pre-warmed.** In Claude: `prepare_submission` on
  the prepared study → **Not Ready — critical finding**: ICF claims "well
  tolerated," protocol documents hepatotoxicity. Span-verified quote on screen.
- **0:55–2:55 — THE LOOP (live).** Presenter: "Here's the wording our medical
  writer drafted — verify it." → `verify_revision` → **REJECTED**: 21 CFR
  50.25(a)(2), foreseeable risks still incomplete, liver-injury disclosure
  missing. Claude reads the structured failure, rewrites the section →
  `verify_revision` → **VERIFIED**, quote grounded in the new text. →
  `prepare_submission` → readiness climbs, **no critical findings → Submission
  Ready** → `generate_regulatory_brief`.
  *(Determinism note: the failing first draft is the **presenter's**, not
  Claude's — we cannot script Claude into failing, but a human draft that
  omits the hepatotoxicity disclosure fails deterministically. The story gets
  better, not worse: human draft fails, Claude + Citera fix it.)*
- **2:55–3:00 — Close.** "Claude generates regulatory documents. Citera proves
  whether Claude is right. That's the trust layer."

Fallback if live Opus hiccups: pre-recorded loop segment; everything else stays live.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Evaluator judges a bare section (no full-ICF context) differently than pack validation | Verification prompt scopes the claim: "does THIS section satisfy THIS requirement" — same shape as per-rule evaluation today; validate live before demo day |
| Claude's rewrite passes on iteration 1 (no visible loop) | Presenter-draft-fails-first structure guarantees one rejection on screen |
| `verify_consent` still risks host timeouts | Progress notifications (already planned); demo uses the pre-warmed review anyway |
| Overlay perceived as "AI grading itself" | Label verified-by-revision findings explicitly; audit trail shows every attempt — lean into it as a feature |

## 8. What this buys against the judge audit

Directly converts the two scores that gate Top 3: Claude Use (16→~21: Claude
is now the actor gaining a capability that exists nowhere else — iterative,
evidence-gated regulatory drafting) and Demo (22→~27: one unforgettable loop
instead of four interfaces). The architecture story survives intact: the loop
is still `Claude → MCP → SDK → REST → Engine`, business logic still exists
once.
