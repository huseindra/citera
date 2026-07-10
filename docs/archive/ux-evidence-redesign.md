# Citera UX Redesign — From AI Pipeline to Human Evidence

Status: PROPOSED (design). Thesis: the reviewer's mental model must be a
**case file**, not a pipeline. Implementation detail moves from the
reading path to the audit record — removed from sight, preserved for
reproducibility.

## 1. New Product Mental Model

Old (developer's): Rule → Retrieval → Chunk → LLM → Satisfied.
New (reviewer's): **a case to defend** —

```
FINDING     what is wrong, how bad, what it costs
EVIDENCE    the exact words, in both documents, verified
REQUIREMENT what the regulation expects (plain language first)
REASONING   why the evidence fails the requirement
DECISION    the human's call — concur, dismiss, override
RECORD      everything above, replayable, signed
```

Every finding behaves like an investigation the reviewer must be able to
defend in an audit. Every screen answers, in order: What happened? Where
is the evidence? What is required? Why does it matter? What do I do?

## 2. Information Architecture

Three surfaces (unchanged count, re-centered content):

- **Start** — begin/resume a review
- **Review** — findings-first workspace (the only daily screen)
- **Record** — the Decision Trail + signed report

## 3. Navigation

Wordmark → Start. Inside a review: `Findings · Document · Record ·
Report` as quiet segmented context, never a sidebar. Keyboard: ↑↓ move
through findings, Enter opens the case, D focuses the document, Esc back.

## 4. Main Workspace — findings first, document on demand

The center stage is no longer the document; it is **the case**.

Why findings and not documents: reviewers are accountable for
*decisions*, not for reading. A document is where evidence lives; a
finding is what they must defend. The queue is the to-do list; the
document is the exhibit room.

```
┌────────────────────────────────────────────────────────────────────────┐
│ Citera   Consent Form B — Study CTX-101      Findings·Document·Record  │
├──────────────────┬─────────────────────────────────────┬───────────────┤
│ 3 need attention │  THE CASE (center stage)            │ (on demand)   │
│──────────────────│                                     │ DOCUMENT      │
│ ● Patients not   │  Patients are not told about        │ with evidence │
│   told real risks│  documented liver risks             │ highlights +  │
│   High impact    │  ─────────────────────────────      │ heat minimap  │
│ ● No right-to-   │  severity ▪ High · blocks IRB       │               │
│   withdraw       │  ...sections per §5 below...        │ opens when    │
│ ● Injury costs   │                                     │ user clicks   │
│   unclear        │                                     │ "view in      │
│ ✓ 5 verified ok  │                                     │  document"    │
└──────────────────┴─────────────────────────────────────┴───────────────┘
```

Findings queue labels are plain-language headlines ("Patients not told
real risks"), never rule ids. Severity is stated as impact, not taxonomy.

> **SUPERSEDED by §5b (Finding Dossier).** The founder's case-file sketch
> replaced both the §5 ordering and every graph concept (§6–7): once the
> evidence ledger shows per-source ✓/❌ verdicts, no graph — including the
> redesigned concept strip — adds information. §5–7 kept for the record.

## 5. Finding Detail Screen (the only screen that matters)

Reading order and why each section exists:

1. **Headline + impact** — first because accountability is first.
   Plain sentence of what is wrong + one line of consequence
   ("An IRB would likely reject this consent."). Never opens with a CFR
   number.
2. **The evidence** — verbatim quotes, side by side when in conflict
   ("The consent form says… / The protocol says…"), each stamped
   `verified in source ✓` and clickable to its exact place in the
   document. Evidence before reasoning: users trust what they can see.
3. **What's required** — the regulation in plain words ("Patients must
   be told every reasonably foreseeable risk"), the citation
   (21 CFR 50.25(a)(2)) as a quiet reference chip, expandable.
4. **Why this fails** — the reasoning paragraph, attributed as
   "Automated analysis", written for a human. No model names, no scores.
5. **Suggested fix** — clearly labeled a suggestion; the reviewer
   decides. Present only when a fix makes sense.
6. **Your decision** — Concur / Dismiss (rationale required) / Override
   severity (rationale required) / Request change / Add note. Buttons in
   the calm bottom band; this is the reviewer's signature moment.
7. **The record** — last three trail events inline ("flagged by
   automated analysis · 10:32", "note added by Maya · 10:40") + "Open
   full record".

Confidence appears once, in section 2, as evidence strength in human
terms: "Strong — exact quote verified in both documents", never a number.

## 6. Evidence View — the Evidence Chain

Replaces the citation graph *in the reading path*. A vertical narrative,
each block one step of proof, readable top-to-bottom like a memo:

```
WHAT'S EXPECTED     Patients must be told all reasonably foreseeable risks
     │
THE PROTOCOL SAYS   "elevated liver enzymes (~3%)… monitored every visit"
     │               verified ✓ · Protocol, Risks & Safety
THE CONSENT SAYS    "no serious or long-term side effects have been
     │               observed"        verified ✓ · ICF, Risks section
THE CONFLICT        the consent contradicts the documented risk profile
     │
SUGGESTED FIX       add liver-risk disclosure and monitoring language
     │
YOUR DECISION       [ Concur ]  [ Dismiss ]  [ Override ]
```

For absences the chain reads: WHAT'S EXPECTED → WHERE WE LOOKED (three
plain phrasings, e.g. "voluntary participation", "right to withdraw") →
NOTHING FOUND → YOUR DECISION. The searches ARE evidence — phrased as
what a diligent human would have looked for, never as "queries".

## 7. Evidence Graph (if kept at all)

Kept only as the horizontal mini-strip version of the chain above —
concepts, not documents; a story, not a data structure:
`Requirement → Expected → Protocol evidence → ICF evidence → Conflict →
Fix → Decision`. Nodes carry plain labels; the grounded quote glows. The
old document-node React-Flow graph is deleted.

## 5b. The Finding Dossier (canonical design)

Every finding opens as a case file — one column, calm rules between
sections, identical on screen and in print (the report is simply the
stack of dossiers; one artifact, two mediums).

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL FINDING #07                      ❌ Missing · High impact
Patients are not told the documented risks
Participants cannot give informed consent to risks
they are never told about. Likely IRB rejection.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHY THIS MATTERS
Participants must be informed of every reasonably
foreseeable risk.                    21 CFR 50.25(a)(2) ▸
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVIDENCE
✓  Protocol · Risks & Safety, p.18 ¶3        verified ✓
   "asymptomatic elevations… ~3%… monitored every visit"
❌ Consent Form
   No matching disclosure found.
   Looked for: risk disclosure · side effects · liver
   monitoring — nothing relevant in any section.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANALYSIS
The protocol states …            (what the source says)
The consent form does not …      (the gap)
Therefore …                      (the conclusion)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECOMMENDED ACTION                          — a suggestion
Insert: "Centraxol may cause elevated liver enzymes…"
                                   [ Request this change ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REVIEW
[ Accept finding ]  [ Override ]  [ Add note ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUDIT      ● Generated 09:15   ● Reviewed —   ● Approved —
                                        open full record ▸
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Formalizations of the sketch:

- **Case numbers** (`#07`): per-review sequential ids — humans reference
  "finding 7" in meetings and reports, never UUIDs.
- **Evidence ledger**: one row per source document with a ✓/❌/— verdict.
  This is what killed the graph — the ledger IS the story, and it
  extends naturally to V2 multi-document studies (IB, diary, SoA rows).
  Every quote carries `verified ✓` and a **human locator**
  (section · page · paragraph ordinal — derivable from spans today).
  Absence rows carry "looked for: …" phrasings — evidence of absence in
  a diligent reviewer's words.
- **ANALYSIS as a syllogism**: states → gap → therefore. Three beats,
  auditable reasoning shape, no meta-commentary.
- **AUDIT as milestones**: Generated → Reviewed → Approved stamps with
  actor + time; the full Decision Trail (incl. the technical record) one
  level down.
- **Ordering note**: the earlier brief said "regulation never first";
  this dossier reads charge → law → exhibits → analysis → remedy →
  disposition, like a real case memo. The header's plain-language
  headline + impact satisfies the original intent — the *citation* still
  never leads, the *requirement in plain words* earns its early slot
  (for Missing findings you must know what was expected before an
  absence means anything).

## 8. Human Review Flow

States: `Open → In review → Decided`. Decisions: **Concur** (one click),
**Dismiss** (rationale required), **Override severity** (rationale
required), **Request change** (creates a task with the suggested fix
pre-filled), **Note** (anytime). Report export blocks until every
finding is Decided; the report carries each decision + rationale +
reviewer + timestamp. (Requires the persisted-decision backend already
planned as V2.3/R3 — this design is its front half.)

## 9. Audit Flow — the Decision Trail

Not hidden, not technical-first. One chronological, human-readable
stream per finding and per review:

```
09:14  Consent Form B uploaded (v1) ................. Aida
09:15  Document analyzed — 8 requirements checked ... automated
09:16  Finding opened: patients not told real risks . automated
10:40  Note added: "check amendment 2 wording" ...... Maya
10:52  Decision: CONCUR — "protocol §6 is unambiguous" Maya  ✍
11:03  Report signed ................................ Maya  ✍
```

Every automated entry expands to the **full technical record** —
parameters, the exact analysis inputs/outputs, the search record with
scores — labeled "Technical record (for audit reproducibility)". This is
where dense/sparse/fused, ranks, prompts, and model identifiers live
from now on: one level down, verbatim, never summarized, never in the
reading path.

## 10. Components to Delete (from the reviewer UI)

| Component | Verdict |
|---|---|
| Semantic Map | **Delete completely** — data visualization, not evidence |
| Citation graph (document nodes, React Flow) | **Delete**; concept-story strip replaces it |
| Retrieval score table (dense/sparse/fused, ranks, fusion params) in the drawer | **Remove from reading path**; survives only inside the Decision Trail's technical record |
| "matched terms", chunk ids, embedding model, `fda-21cfr50 v1.0.0` chips | Remove / move to technical record |
| Model chips ("claude-sonnet-5") in header & assessment | Move into the technical record entry ("analysis performed by model X vY") |
| "Claude evaluating…" theater copy | Keep the theater, humanize the words: "Checking: risks disclosure…" |
| Health dot / embeddings diagnostics in product chrome | Dev/ops page only |

## 11. Components to Add

Plain-language finding headlines + impact line (content layer per rule);
Evidence Chain view; decision band (concur/dismiss/override/note/request
change) with persistence; Decision Trail stream with expandable
technical records; "Where we looked" absence block; report gate on
undecided findings.

## 12. Wireframes

Workspace: §4. Finding detail: §5–6. Decision Trail: §9.

## 13. User Journey

Open review → queue says "3 need attention" → click the worst → headline
tells you what and why it matters in five seconds → both quotes on
screen, each verified, click to see them in the document → requirement
in plain words → reasoning → decide, with rationale → trail records it →
last finding decided → report unlocks → sign. At no point did the user
need to know the words retrieval, embedding, or LLM — yet every claim
they saw was mechanically verified and every action they took is
replayable.

## 14. Why This Improves Trust

Trust is not produced by showing the machinery; it is produced by
answering the reviewer's actual questions (what/why/where/what now) with
verifiable artifacts, and keeping the machinery *available* one level
down for the one person who ever needs it: the auditor. Scores made the
product feel like a system that needed defending. Evidence makes it feel
like a colleague who shows their work. The pipeline didn't get less
rigorous — it got quieter.
