# UX Redesign — Phase 1 (approved)

Design spec for the post-MVP UX. Approved plan; implemented incrementally
(P1–P5), one branch per increment. Inspiration principles (not copies):
Linear (keyboard, calm chrome), Perplexity (evidence-forward reading),
Figma (3-column inspector), Notion/GitHub (progressive disclosure).

## Information architecture — three surfaces, no fourth

| Surface | Route | Single job |
|---|---|---|
| Start | `/` | 30-second comprehension + start a review |
| Workspace | `/reviews/:id` | The whole review lifecycle — reviewer never leaves |
| Report | `/reviews/:id/report` | Print artifact + sign-off |

## Workspace layout (P1)

Three resizable columns, no tabs for important features:

```
Findings rail (~320px) · Document (flex, serif + minimap) · Inspector (~380px)
```

- **VerdictStrip** on top of the rail when complete ("3 of 8 need attention").
- **Inspector** (replaces the bottom drawer): one scrolling column in the
  product hierarchy order — Evidence Path strip → quote / conflict pair /
  absence card → Claude's assessment (+ strength meter) → collapsed
  Retrieval and Audit sections (one click away, never one tab away) →
  citation graph via expand-to-modal.
- Theater state while running: all rules listed, active row pulsing.

## Increments

- **P1** Inspector 3-column + VerdictStrip (structural core)
- **P2** Animated EvidencePathStrip + StrengthMeter + GraphModal
- **P3** Start polish: real upload progress (XHR), slot metadata
- **P4** Review playback — re-animate a completed review from its findings
- **P5** DOCX ingestion (small additive backend: python-docx in extract)

Rejected on purpose: percentage confidence (false precision — tiers only),
evidence-relationship explorer (demo-ware), Suggested Rewrite (needs a new
backend surface → Phase 2).
