# Sample Documents

Realistic **fully synthetic** dummy documents, ready to upload in the
Playground or pass to Claude MCP (`verify_consent` accepts the PDF
paths directly). No real clinical content anywhere.

## ONC-450 — the Verification Loop demo pair

Fictional Phase 3 study of "Zelparib" (PARP inhibitor) for advanced
ovarian cancer, sponsor "Aruna Therapeutics". **Deliberately defective**
— built to demonstrate the Verification Loop:

| File | Role |
|---|---|
| `onc-450-protocol.pdf` / `.md` | Study protocol documenting myelosuppression (Grade ≥3 anemia ~18%) and a rare risk of MDS/AML |
| `onc-450-icf.pdf` / `.md` | Informed consent claiming Zelparib is "generally well tolerated" — plus an incomplete injury-compensation section |

**What to expect (verified live through Claude MCP):** `Not ready —
critical findings`. The risks section **Contradicts the protocol**
(critical) and injury compensation is **Incomplete** — then
`explain_failure` → `verify_revision` → `prepare_submission` walks it to
**Submission Ready**.

## VTZ-2201 — the realistic near-compliant pair

Fictional Phase 2b study of "Veltrazane" (anti-IL-31RA antibody) for
atopic dermatitis, sponsor "Meridian Biopharma".

| File | Role |
|---|---|
| `vtz-2201-protocol.pdf` / `.md` | Study protocol — ICH-style: synopsis, objectives/endpoints, eligibility, schedule-of-activities table, safety profile, statistics, ethics (§50.25 mapping), injury compensation, contacts |
| `vtz-2201-icf.pdf` / `.md` | Informed consent — modern FDA style with a "Key Information" summary, numbered sections, all eight 21 CFR 50.25(a) elements |

**What to expect from a review:** the VTZ pair is deliberately *almost*
compliant — real documents usually are. One subtle drift is planted:
the ICF states blood draws of **~10 mL per visit** while the protocol's
schedule of activities specifies **~15 mL** (20 mL at screening).
In live testing Claude flags `purpose-procedures` as **partial** and
passes the other seven elements — a realistic nuanced result, unlike the
deliberately broken demo corpus (`packages/rulesets/demo-corpus/`).

Regenerating the PDFs from markdown (pandoc + Chrome headless):

```bash
pandoc samples/vtz-2201-icf.md -s --css <doc.css> --embed-resources -o /tmp/icf.html
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --no-pdf-header-footer --print-to-pdf=samples/vtz-2201-icf.pdf /tmp/icf.html
```

Note: keep section headings **numbered** — PDF extraction loses markdown
markers, and the chunker's section detection falls back to numbered
headings.
