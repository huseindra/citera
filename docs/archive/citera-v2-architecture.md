# Citera V2 — Product & Architecture Specification

Status: PROPOSED (design only). Author: founding engineering. Supersedes
the document-pair architecture; preserves the trust infrastructure
unchanged in role, expanded in scope.

Non-negotiable inheritance from V1 (the actual product): deterministic
verification, two-way evidence grounding, evidence-of-absence,
append-only audit, replayable review, verifiable citations.

Core principle, operationalized: verification > generation ·
deterministic logic > probabilistic reasoning · structured claims >
embeddings · evidence > confidence score.

---

## 1. Product Architecture

The primary object is the **Study** — a living workspace that owns
documents (as versioned assets), claims, findings, decisions, and audit
history. Reviews stop being one-shot runs against a document pair and
become a continuous property of the study: every document version change
re-derives claims, re-runs consistency, and re-opens only the findings it
affects.

```
Study
 ├─ Documents (protocol, ICF, IB, recruitment, SoA, diary, amendments…)
 │    └─ DocumentVersions (immutable; canonical text + spans)
 ├─ Claims Index (typed, normalized, grounded, versioned)
 ├─ Findings (rule / consistency / absence) ── ReviewDecisions (human, signed)
 ├─ Engine Runs (reproducibility envelope)
 ├─ Audit Events (append-only)
 └─ Readiness (derived, never stored as truth)
```

## 2. Technical Architecture

```
Ingestion (deterministic)     parse → canonical text → spans → chunks → embeddings
      ↓
Claim Extraction (LLM)        per doc-version, per claim-type batch; forced tool;
      ↓                       EVERY original_text passes the grounding gate
Normalization (deterministic) "six (6)" → 6 · "24 weeks" → ISO-8601 P24W ·
      ↓                       dosage → {value, unit, frequency}
Claims Index (Postgres)       the reasoning substrate
      ↓
Consistency Engine (deterministic)   SQL joins + typed comparators;
      ↓                              LLM only adjudicates semantic ambiguity
Rule Engine (declarative, versioned) claim_rules (deterministic over the index)
      ↓                              + judgment_rules (retrieval + LLM, V1 path)
Findings → Review Decisions → Audit → Reporting/Readiness
```

Retrieval (hybrid, provider-agnostic per E1) is retained for *finding*
evidence and judgment rules. Claims are for *comparing*. Vectors locate;
claims decide.

### Why the Claims Index beats pure vector retrieval

1. **Numbers**: "6 visits" and "4 visits" are near-identical in embedding
   space; they are a one-line integer comparison in a claims table.
2. **Absence**: vectors cannot return "this does not exist"; a missing
   row for an expected claim type can — with the extraction queries as
   evidence-of-absence.
3. **Identity**: cross-document consistency needs "these two statements
   are about the same thing" — that is typing + normalization, not
   similarity.
4. **Versioning**: claims pin to document versions; an amendment produces
   a claims diff, which produces a findings delta. Embeddings diff into
   noise.
5. **Auditability**: a SQL join is replayable and explainable to an
   auditor; a similarity threshold is not.
6. **Cost**: consistency becomes O(claims join), not O(n² document-pair
   LLM comparisons).

## 3. Database Schema (tables and why they exist)

| Table | Why it exists |
|---|---|
| `studies` | Aggregate root; the workspace boundary and tenancy unit |
| `documents` | Document *identity* (role: protocol/icf/ib/…); stable across versions |
| `document_versions` | Immutable content (canonical_text, hash, page_map, version_no, uploaded_by). Amendments are first-class; every claim/finding pins here |
| `chunks` | Per doc-version retrieval substrate (spans, tsv, embedding) — unchanged from V1 |
| `claims` | The reasoning substrate: id, study_id, document_version_id, claim_type, normalized_value (typed JSONB), original_text, char_start/end, page, grounded (bool — gate result), extraction_meta (model, prompt_version, run_id), status (active/superseded) |
| `claim_links` | Graph edges in Postgres: (claim_a, claim_b, relation: corroborates/conflicts/refines, engine_run_id). Recursive CTEs before any graph DB |
| `rulesets` / `rules` | Registered rule-pack versions with content hashes; findings must reference the *exact* rule content that judged them |
| `findings` | Unified output: kind (rule/consistency/absence), rule_id?, claim_ids[], status, spans, reasoning, engine_run_id |
| `review_decisions` | The system-of-record core: finding_id, decision (concur/override/waive), rationale, reviewer_id, signed_at — Part 11 trajectory |
| `engine_runs` | Reproducibility envelope: what ran, model+params, ruleset versions, claim-registry version |
| `audit_events` | Append-only (existing trigger pattern), now with actor |
| `assignments` | Finding → user + due date; the workspace becomes a queue |
| `users` / `roles` | The V1 auth debt lands here, non-optional in V2 |

Migrations: **adopt Alembic at V2.0**. create_all was right for the
hackathon; a system of record does not drop-recreate.

## 4. Domain Model

`Study` (root) — owns everything; `DocumentVersion` (immutable value of a
`Document`); `Claim` (typed assertion with provenance); `Finding`
(machine-produced, evidence-backed); `ReviewDecision` (human-produced,
signed; findings are never "closed" by machines); `EngineRun` (the
reproducibility unit — every claim and finding traces to one);
`RulePack` / `ClaimTypeRegistry` (versioned content, not code).

Claim-type registry (declarative YAML, like rules): each type declares
`kind` (integer/duration/quantity/money/text/list), a normalizer, and a
comparator (`exact_int`, `quantity_tolerance`, `set_missing`,
`semantic_adjudicate`). Initial registry (10): visit_count,
treatment_duration, dosage, compensation, risk_item, primary_endpoint,
secondary_endpoint, study_population, withdrawal_criteria,
emergency_contact.

## 5. API Design (domain-organized; design only)

```
POST/GET        /studies                        create, list (health summary)
GET             /studies/{id}                   overview: readiness, counts
POST            /studies/{id}/documents         upload (new document or new version)
GET             /studies/{id}/documents[/{docId}/versions[/{v}/text|diff]]
GET             /studies/{id}/claims?type=&document_version=&status=
GET             /claims/{id}                    provenance + links + findings
POST            /studies/{id}/runs              trigger extract/consistency/rules (async)
GET             /runs/{id}                      engine-run envelope
GET             /studies/{id}/findings?status=&kind=&assignee=
GET             /findings/{id}/evidence|audit   (V1 endpoints, re-homed)
POST            /findings/{id}/decision         concur/override/waive + rationale (signed)
POST            /findings/{id}/assignment
GET             /rulesets[/{id}]                versions + content hashes
GET             /studies/{id}/readiness         derived score + blockers
GET             /studies/{id}/report            submission-readiness package
GET             /audit?study_id=&actor=&step=   append-only, filterable
GET             /health /health/embeddings      unchanged (E1)
```

## 6. UI Structure (study-centric)

| Page | Content |
|---|---|
| **Portfolio** | All studies: health dot, open findings, pending decisions, last activity |
| **Study Overview** | Readiness score + blockers, findings by severity, affected documents, activity timeline |
| **Documents** | Assets with version history; upload amendment; version diff (text + claims delta) |
| **Claims Explorer** — V2's signature screen | Matrix: claim type × document ("Protocol says 6 · ICF says 4 · Diary says 6") with status chips; every cell click-through to its span |
| **Findings Queue** | Filterable worklist (status/kind/severity/assignee); keyboard-first triage |
| **Finding Inspector** | V1 inspector evolved: both claims side-by-side with spans, regulation, Claude's adjudication where applicable, decision panel (Concur/Override + rationale + sign) |
| **Audit** | Study-wide replayable timeline (V1 replay generalized) |
| **Report** | Signed submission-readiness package (V1 report generalized) |

## 7. User Workflow (primary loop)

Create study → upload documents (each upload = version) → extraction +
consistency run automatically → findings queue populates → assign →
reviewer inspects evidence (both spans) → decides (concur/override +
rationale, signed) → readiness updates → **amendment arrives** → claims
re-extracted only for the changed version → claims diff → affected
findings re-open with "impacted by v3" markers → export report.

## 8. Sequence (amendment, the defining flow)

```
Reviewer uploads protocol v3
 → parse (det.) → extract claims (LLM, every quote grounded) → normalize (det.)
 → claims diff vs v2 (det.)          [changed: visit_count 6→8]
 → consistency engine (SQL joins)    [ICF v2 still says 6 → CONFLICT finding]
 → affected judgment rules re-queued [only rules touching changed claims]
 → findings delta + assignments      → reviewer decides → audit + readiness
Every arrow writes an audit event; the whole chain shares one engine_run id.
```

## 9. Multi-Agent Assessment

**Verdict: parallel single-purpose LLM calls under a deterministic
orchestrator — not an autonomous swarm.** Same philosophy as V1, scaled.

| Proposed agent | Verdict | Why |
|---|---|---|
| Parser | **Rejected** | pdfplumber/python-docx are deterministic code |
| Claim Extractor | **Accepted (LLM)** | genuine language understanding; parallel per doc-version × type-batch; outputs grounded or rejected |
| Consistency Checker | **Rejected as agent** | SQL joins + typed comparators; an LLM comparing integers is malpractice |
| Regulation Evaluator | **Accepted (LLM)** | judgment rules — the V1 evaluator, unchanged in role |
| Ambiguity Adjudicator | **Accepted (LLM)** | only for `semantic_adjudicate` comparators |
| Evidence Collector | **Rejected as agent** | hybrid retrieval is deterministic infrastructure |
| Report Generator | **Accepted (LLM)** | synthesis with validated references (R4 design) |
| Audit Recorder | **Rejected — it's a database** | an "audit agent" would be the least trustworthy audit imaginable |

Communication: through the database (claims index, findings, audit) —
never agent-to-agent chat. Shared memory: the claims index IS the shared
memory. Orchestration: deterministic staged pipeline with fan-out and
per-item isolation (V1's per-rule pattern, generalized).

## 10. Migration Plan (V1 → V2)

**Reuse as-is / thin adaptation** — the trust layer: grounding module
(now also gates claim extraction), audit trigger + replay pattern, rule
YAML + loader (expanded to packs), hybrid retrieval + E1 providers,
ingestion/span pipeline, UI atoms (viewer, minimap, inspector shell,
theater, report page).

**Rewrite**: domain layer (review-as-root → study aggregate + engine
runs), DB schema (fresh Alembic baseline), orchestrator (per-rule loop →
staged pipeline), frontend routing/IA (document workspace → study
workspace; V1 review screen survives as the Finding Inspector's document
context).

**Delete**: semantic map (demo-ware, already flagged), public /retrieval
endpoint (becomes internal), review-centric pages.

**Data**: V1 demo data is regenerable — no data migration; seed scripts
evolve instead.

**Complexity estimates**: schema+Alembic M · claim registry+extraction
XL (the bet) · consistency engine M · workspace UI L · auth/RBAC L ·
rule-pack expansion M-per-pack (content work).

## 11. Technical Risks

1. **Claim extraction quality** is the load-bearing bet — mitigations:
   grounding gate on every claim, normalizer coverage tests per type,
   extraction eval set (the V1 answer-key pattern, per claim type),
   start with 10 types and resist registry sprawl.
2. **Normalization edge cases** ("up to 8 visits", "6–8 weeks") —
   normalized_value supports ranges; comparators must too.
3. **Schema churn** — Alembic from day one of V2.
4. **Cost per study** — batch extraction, prompt caching, re-extract
   only changed versions.
5. **Auth/PHI debt compounds** — V2.1 hard gate; a system of record
   without access control is a liability, not a product.
6. **Scope**: the Claims Explorer must not become a BI tool; it exists
   to answer "do my documents agree," nothing else.

## 12. Recommended Implementation Order

```
V2.0  Foundations: Alembic baseline, study/document-version aggregate,
      re-home V1 review under a study (V1 keeps working inside V2 shell)
V2.1  Claims: registry (10 types), extractor + grounding, normalizers,
      Claims Explorer (read-only)  ← first visible V2 value
V2.2  Consistency engine + unified findings + amendment diff flow
V2.3  Workspace: decisions persisted (concur/override + rationale),
      assignments, findings queue, readiness v1
V2.4  Rule packs: Common Rule first (content), then ICH-GCP; EMA/BPOM after
V2.5  Auth/RBAC + audit actors + Part 11 groundwork (e-sign of decisions)
```

Rationale: substrate before surface — claims before screens, screens
before scale. Each stage ships and demos independently.
