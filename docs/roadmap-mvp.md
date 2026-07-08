# MVP Roadmap — Hackathon

Goal: a working, demo-quality slice of Citera that proves the core thesis — **AI that generates evidence, not answers** — in a single reviewer flow.

> Task-level breakdown, stack decisions, and risk register: [implementation-plan.md](implementation-plan.md).

Demo narrative: upload a synthetic ICF → Citera validates it against FDA 21 CFR 50.25 → the reviewer sees a Coverage Matrix with one missing element and one protocol conflict → clicks a finding → the document highlights the exact evidence span → opens the evidence panel, citation graph, and audit replay to verify independently.

## MVP Scope Decisions

In scope: one rule set (FDA 21 CFR 50.25 subset), text-based PDFs only, one database (PostgreSQL + pgvector), synthetic demo documents, single-user (no auth).

Out of scope (deliberately): OCR for scanned documents, authentication, Common Rule / other rule sets, reranking models, Qdrant, Neo4j, document versioning/diff, AI-assisted drafting, full evaluation harness (the planted-defect demo corpus acts as a mini golden set).

Hard rules that survive even in hackathon mode:

1. **Evidence span contract** — every chunk and finding carries `(document_id, page, char_start, char_end)`.
2. **Span-grounding validation** — a finding whose quote cannot be located verbatim in the source is rejected. No exceptions, even for the demo.
3. **Audit record** — every pipeline step writes to the append-only audit log. Audit Replay = record-and-show, never re-execute.
4. **Synthetic documents only** — no real clinical documents anywhere near this repo.

---

## Milestone 0 — Scaffold & Contracts

**Goal:** repo skeleton with the two data contracts locked, so every later milestone builds on stable types.

**Deliverables**
- Final structure: `apps/web` (React + Vite + TS + Tailwind + TanStack Query), `apps/api` (FastAPI), `packages/pipeline`, `packages/schemas`, `packages/rulesets`
- `packages/schemas`: Pydantic models — `EvidenceSpan`, `Chunk`, `RetrievalResult`, `Finding` (status: `satisfied | partial | not_found | conflicting`), `AuditRecord`
- docker-compose updated: PostgreSQL with pgvector image (`pgvector/pgvector:pg16`), Qdrant service removed
- API and web app boot with a health check

**Dependencies:** none.

**Acceptance criteria:** `docker compose up` + API + web all start; schemas importable from `packages/schemas`; a `Finding` cannot be constructed without an `EvidenceSpan`.

**Complexity:** S

---

## Milestone 1 — Demo Corpus & Rule Set

**Goal:** the content that makes the demo tell a story — can be built in parallel with everything else.

**Deliverables**
- 1 synthetic Study Protocol (fictional trial, ~8–12 pages)
- 2 synthetic ICFs: **ICF-A (clean)** — all elements present and consistent; **ICF-B (planted defects)** — one required element missing entirely, one element conflicting with the protocol (e.g. different risk disclosure or visit count), one element only partially covered
- `packages/rulesets/fda-21cfr50/`: 8–10 requirements as declarative YAML — `{id, citation, title, description, retrieval_queries, evaluation_criteria, severity}`
- Defect answer key (`docs/demo-script.md` draft) mapping each planted defect to the expected finding

**Dependencies:** none (content work; schema field names align with M0 when both land).

**Acceptance criteria:** each planted defect maps 1:1 to a rule in the rule set; documents read as plausible clinical documents; answer key reviewed.

**Complexity:** S

---

## Milestone 2 — Ingestion with Evidence Spans

**Goal:** documents in, chunks out — with character offsets that survive the whole pipeline.

**Deliverables**
- Upload endpoint (PDF/text) → text extraction (pdfplumber/pypdf, digital PDFs only)
- Section-aware chunking: respects heading boundaries, records `(page, char_start, char_end, section_title)` per chunk
- Chunk content-hash for dedup
- Documents + chunks persisted; ingestion steps written to audit log

**Dependencies:** M0.

**Acceptance criteria:** upload ICF-B → chunks in DB; for any chunk, slicing the stored document text by its offsets reproduces the chunk text exactly (round-trip test); re-uploading the same file creates no duplicate chunks.

**Complexity:** M

---

## Milestone 3 — Hybrid Retrieval with Explainability Payload

**Goal:** retrieval that can show its work.

**Deliverables**
- Embedding pipeline (hosted embedding API; model + version stored per chunk)
- Dense search (pgvector) + sparse search (Postgres full-text) + Reciprocal Rank Fusion
- Retrieval API: given a rule's queries, returns chunks each carrying `{dense_score, sparse_score, fused_score, rank, matched_terms, span}` plus the exact queries executed
- Every retrieval logged to the audit log with an id (the hook Audit Replay hangs on)

**Dependencies:** M2.

**Acceptance criteria:** for rule "risks disclosure", retrieval on ICF-B returns the risk section in the top 3 with both score types populated; the executed queries are visible in the API response; retrieval for a nonsense query returns an honest empty result (needed for "evidence of absence").

**Complexity:** M

---

## Milestone 4 — Finding Engine (the core)

**Goal:** Claude evaluates each requirement against retrieved evidence and produces grounded, auditable findings.

**Deliverables**
- Per-requirement evaluation: rule + retrieved chunks + protocol context → Claude (structured output via tool use, temperature 0, prompt caching for the shared document context)
- Finding: `{rule_id, status, verbatim_quote, span, reasoning, evidence_strength: strong|moderate|weak}` — evidence strength derived from retrieval + grounding, **not** raw LLM self-confidence
- **Span-grounding gate:** quote is programmatically located in the source; located → span attached; not found → finding rejected and logged
- `not_found` findings record the queries that were executed and returned nothing (evidence of absence)
- Full audit record per finding: prompt, model version, params, retrieval snapshot ids, raw response
- "Run review" endpoint: document + rule set → all findings

**Dependencies:** M1, M3.

**Acceptance criteria:** review of ICF-B yields the three planted findings with correct statuses (`not_found`, `conflicting`, `partial`) and correct spans; review of ICF-A yields all/mostly `satisfied`; a finding with a fabricated quote is rejected by the grounding gate (unit test); every finding has a complete audit record.

**Complexity:** L — budget the most time here; it is the product.

---

## Milestone 5 — Reviewer Screen: Coverage Matrix + Evidence Heatmap

**Goal:** the demo centerpiece — answer "what's wrong and where's the evidence" in one glance and one click.

**Deliverables**
- Split view: **Coverage Matrix** left (rule × status, color-coded, severity-sorted), **document pane** right with rendered text and highlight overlays positioned by evidence spans (this is the Evidence Heatmap — highlights colored by finding status/evidence strength)
- Click matrix row → document scrolls to and pulses the evidence span; `not_found` rows show the evidence-of-absence summary instead
- Status + evidence-strength shown as tiers/labels, not raw percentages

**Dependencies:** M4.

**Acceptance criteria:** reviewer answers "what is wrong / where is the evidence / which regulation" for ICF-B in under 10 seconds of interaction; spans highlight the correct text; matrix accessible as a plain table (keyboard navigable).

**Complexity:** L

---

## Milestone 6 — Explainable Retrieval Panel + Citation Graph

**Goal:** independent verification — the "never hide retrieval" promise, visible.

**Deliverables**
- Finding drawer, two layers: **Reviewer layer** — verbatim quote, regulation citation, plain-language reasoning, protocol reference; **Audit layer** (expandable) — executed queries, per-chunk dense/sparse/fused scores, ranks, fusion params
- **Citation Graph** per finding: Regulation → Protocol section → Evidence chunk(s) → Finding, as an interactive node view (a lightweight graph/flow library; data is a small DAG from the finding record — no graph database)
- Clicking any evidence node jumps to its span in the document

**Dependencies:** M5.

**Acceptance criteria:** for the `conflicting` finding, the drawer shows both the ICF quote and the conflicting protocol section; audit layer shows real retrieval scores; graph nodes navigate to spans.

**Complexity:** M

---

## Milestone 7 — Audit Replay

**Goal:** prove auditability — walk backward from any finding to everything that produced it.

**Deliverables**
- Replay timeline per finding: ingestion → queries → retrieval results (with scores) → prompt context (inspectable) → model + params → raw response → grounding validation result
- Strictly record-and-show from the audit log; a visible "recorded at / model version" stamp

**Dependencies:** M4 (data already exists; this is presentation).

**Acceptance criteria:** for any finding, every step shows real recorded data with timestamps; the prompt shown is the exact prompt sent; no step triggers re-execution.

**Complexity:** S–M

---

## Milestone 8 — Semantic Evidence Map (demo polish)

**Goal:** the visual wow — show the document's semantic space and where evidence concentrates.

**Deliverables**
- 2D projection of chunk embeddings (PCA/UMAP, precomputed server-side), scatter colored by matched rule / evidence strength, grey for unmatched chunks
- Hover → chunk preview; click → span in document; overlay of rule query positions

**Dependencies:** M3 (embeddings); slots in any time after, independent of M5–M7.

**Acceptance criteria:** clusters visibly correspond to document sections; evidence chunks for a selected rule light up; interaction stays smooth (precomputed coordinates, no live projection).

**Complexity:** S–M

---

## Milestone 9 — Demo Script & Polish

**Goal:** a rehearsable 5-minute demo that never surprises the presenter.

**Deliverables**
- `scripts/seed_demo.py`: reset DB → ingest corpus → run review → warm state
- `docs/demo-script.md` final: beat-by-beat walkthrough — clean ICF-A first (trust), then ICF-B (the three defects), ending on Audit Replay ("don't trust the model — verify the evidence")
- Empty/loading/error states on demo path; demo settings pinned (model version, rule set)

**Dependencies:** M5 minimum; ideally M6–M8.

**Acceptance criteria:** seed script produces the full demo state from scratch in one command; demo runs end-to-end twice in a row without manual fixes.

**Complexity:** S

---

## Sequencing

```
M0 Scaffold ──► M2 Ingestion ──► M3 Retrieval ──► M4 Findings ──► M5 Reviewer Screen ──► M6 Evidence Panel + Graph ──► M9 Demo
M1 Corpus (parallel, needed by M4)                    │                                        M7 Audit Replay (after M4)
                                                      └──► M8 Semantic Map (anytime after M3)
```

Suggested cut lines if time runs out, in order of sacrifice: M8 (semantic map) → M7 becomes a raw JSON audit view → M6 citation graph becomes a nested list (keep the two-layer drawer). **Never cut:** span grounding (M4), the matrix+heatmap screen (M5), the planted-defect corpus (M1) — without those there is no differentiation story.
