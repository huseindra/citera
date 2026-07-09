# Sample Documents — Study VTZ-2201

Realistic **fully synthetic** dummy documents, ready to upload in the
Playground (PDF or markdown — both work). Fictional Phase 2b study of
"Veltrazane" (anti-IL-31RA antibody) for atopic dermatitis, sponsor
"Meridian Biopharma". No real clinical content anywhere.

| File | Role |
|---|---|
| `vtz-2201-protocol.pdf` / `.md` | Study protocol — ICH-style: synopsis, objectives/endpoints, eligibility, schedule-of-activities table, safety profile, statistics, ethics (§50.25 mapping), injury compensation, contacts |
| `vtz-2201-icf.pdf` / `.md` | Informed consent — modern FDA style with a "Key Information" summary, numbered sections, all eight 21 CFR 50.25(a) elements |

**What to expect from a review:** this pair is deliberately *almost*
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
