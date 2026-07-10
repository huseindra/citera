# Demo Script

Status: **final** (M9). The answer key below doubles as M4's acceptance
test and the seed script's verification.

## Pre-demo checklist

```bash
docker compose up -d          # postgres + pgvector (host port 5433)
uv sync && make seed          # reset DB, ingest corpus, run both reviews
make api                      # terminal 1 — http://localhost:8000
make web                      # terminal 2 — http://localhost:5173
```

- `make seed` must end with two rows of 8 ✓ and print the two review URLs.
  Run it right before the demo — the state is then exactly this script.
- **Without `ANTHROPIC_API_KEY`** the deterministic scripted evaluator runs
  (identical output every time — zero demo risk). **With the key**, real
  Claude (`CLAUDE_MODEL`, default claude-sonnet-5) evaluates; seed prints
  warnings if any status drifts from the answer key — check before demoing.
- Pin the config for the demo: `.env` with `LLM_PROVIDER`,
  `EMBEDDINGS_PROVIDER`, `CLAUDE_MODEL` set explicitly.
- Open both seeded review URLs in tabs beforehand.

## Corpus

| Document | File | Role |
|---|---|---|
| Study Protocol CTX-101 | `packages/rulesets/demo-corpus/protocol.md` | Source of truth the ICFs are checked against |
| ICF Version A | `packages/rulesets/demo-corpus/icf-a.md` | Clean — passes all 8 rules |
| ICF Version B | `packages/rulesets/demo-corpus/icf-b.md` | Draft with 3 planted defects |

All documents are fully synthetic (fictional drug "Centraxol", fictional
sponsor "Aruna Therapeutics"). No real clinical content.

## Expected findings — the answer key

**ICF-A:** all 8 rules of `fda-21cfr50` → **satisfied**.

**ICF-B:**

| Rule | Expected status | Planted defect | Evidence the AI must surface |
|---|---|---|---|
| `fda-50.25-a2-risks` | **conflicting** | Risks section claims Centraxol is "well tolerated", "no serious or long-term side effects have been observed" | ICF-B quote from "What are the risks and discomforts?" **vs** protocol §6: elevated liver enzymes ~3% + serious hypersensitivity (angioedema); frequencies dropped |
| `fda-50.25-a6-injury-compensation` | **partial** | "What happens if I feel unwell" mentions only that "medical care is available at the study clinic" | Availability of care addressed; **who pays** and **whether compensation exists** are silent — protocol §10 requires both |
| `fda-50.25-a8-voluntary` | **not_found** | Voluntary-participation section deleted entirely, including from the signature block | No quote exists — the finding shows **evidence of absence**: the executed queries and zero relevant matches |

Remaining 5 rules → **satisfied** (ICF-B keeps those sections identical in
substance to ICF-A).

## The 5-minute demo, beat by beat

1. **Open ICF-A's review — all green.**
   "Citera validated this consent form against all eight required elements
   of FDA 21 CFR 50.25. Everything checks out — it doesn't cry wolf."
   *(10 seconds. Establishes trust; move on quickly.)*

2. **Open ICF-B's review — the matrix tells the story.**
   Three non-green rows sorted to the top: ✗ Conflicting, △ Partial,
   ∅ Not found. "Same protocol, a draft consent form. Three problems,
   ranked by severity, each answerable in one click: what's wrong, where's
   the evidence, which regulation."

3. **Click the ✗ Conflicting row (risks).**
   The document scrolls and pulses on the "well tolerated" paragraph.
   In the drawer's Evidence tab: *Document says* "no serious or long-term
   side effects have been observed" side by side with *Protocol says*
   liver enzyme elevations ~3% + angioedema. "The AI didn't just flag a
   section — it quoted the exact sentence, verbatim and verified: if that
   quote didn't exist in the document, the pipeline rejects the finding."

4. **Click the ∅ Not found row (voluntary participation).**
   No highlight — instead the evidence-of-absence panel: the queries that
   were executed and found nothing. "When Citera says something is
   missing, it shows you how hard it looked. Absence with evidence."

5. **Open the Citation graph tab** on the conflicting finding.
   Regulation → protocol → evidence chunk (ring-highlighted) → finding.
   "Every conclusion is a path you can walk, not a paragraph you must trust."

6. **Open the Audit replay tab — the closer.**
   Walk the timeline: ingestion → retrieval (scores) → the exact prompt
   (expand it — monospace, byte for byte) → the model's response →
   grounding → persisted. "Recorded, never re-executed. This is the
   difference between explainable and auditable."

   Closing line: **"Don't trust the model. Verify the evidence."**

7. **Export report (if time allows, 15 seconds).**
   Click *Export report* — a print-ready compliance report with every
   verified quote, audit reference, and a **reviewer determination block
   (Concur / Override) + signature line** per finding. "The AI finds;
   the human decides — and signs."

**Encore (if asked "is this live?"):** upload `icf-b.md` again from the
home page, run a fresh review, watch the matrix fill in at 1.5s polling.

**Optional flourish:** toggle **Semantic map** on the ICF-B review —
colored dots are chunks carrying evidence; click one to jump the document.

## If time runs short

Beats 3 → 4 → 6 are the differentiation story (grounded quote, evidence
of absence, audit replay). Cut 1, 5, and the flourish first.
