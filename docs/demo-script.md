# Demo Script — Answer Key (draft)

Status: **draft** — the answer key below is final content (it is M4's acceptance
test); the beat-by-beat presentation script is finalized in M9.

## Corpus

| Document | File | Role |
|---|---|---|
| Study Protocol CTX-101 | `packages/rulesets/demo-corpus/protocol.md` | Source of truth the ICFs are checked against |
| ICF Version A | `packages/rulesets/demo-corpus/icf-a.md` | Clean — expected to pass all 8 rules |
| ICF Version B | `packages/rulesets/demo-corpus/icf-b.md` | Draft with 3 planted defects |

All documents are fully synthetic (fictional drug "Centraxol", fictional sponsor
"Aruna Therapeutics"). No real clinical content.

## Expected findings — ICF-A

All 8 rules of `fda-21cfr50` → **satisfied**.

## Expected findings — ICF-B (the answer key)

| Rule | Expected status | Planted defect | Evidence the AI must surface |
|---|---|---|---|
| `fda-50.25-a2-risks` | **conflicting** | Risks section claims Centraxol is "well tolerated", "most participants experienced no side effects", "no serious or long-term side effects have been observed" | ICF-B quote from "What are the risks and discomforts?" **vs** protocol §6: elevated liver enzymes in ~3% (with mandated per-visit liver monitoring) and a serious hypersensitivity reaction (angioedema) in Phase 1b. The ICF also drops the headache/nausea frequencies (12% / 8%). |
| `fda-50.25-a6-injury-compensation` | **partial** | "What happens if I feel unwell" mentions only that "medical care is available at the study clinic" | The ICF addresses availability of care but is silent on **who pays** and on **whether compensation is available** — protocol §10 requires the ICF to state the sponsor pays treatment costs and that no additional compensation is provided. |
| `fda-50.25-a8-voluntary` | **not_found** | The voluntary-participation section was deleted entirely; the signature block does not say "voluntary" either | No quote exists. The finding must instead show **evidence of absence**: the queries executed (voluntary participation, right to withdraw, refusal without penalty) and that none matched. |

Remaining 5 rules (a1 purpose/procedures, a3 benefits, a4 alternatives,
a5 confidentiality incl. FDA-inspection notice, a7 contacts) → **satisfied**;
ICF-B intentionally keeps those sections identical in substance to ICF-A.

## Why these three defects

They exercise all three non-satisfied evidence paths — a conflict (two quotes,
ICF vs protocol), a partial (one quote, incomplete element), and an absence
(zero quotes, evidence-of-absence) — which is exactly the differentiation story:
each failure mode produces a *different kind of inspectable evidence*.

## Demo beats (to finalize in M9)

1. Open ICF-A review — all green, establish trust ("it doesn't cry wolf").
2. Open ICF-B — matrix shows 3 non-green rows, sorted by severity.
3. Click `a2-risks` → document highlights the "well tolerated" paragraph;
   drawer shows it side-by-side with protocol §6.
4. Click `a8-voluntary` → no highlight; show the queries that searched and
   found nothing. *"When Citera says something is missing, it shows you how
   hard it looked."*
5. Open Audit Replay on one finding → close: *"Don't trust the model.
   Verify the evidence."*
