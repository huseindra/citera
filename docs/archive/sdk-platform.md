# Citera Platform Revision — SDK First

Status: PROPOSED. Repositioning: Citera is a **Clinical Regulatory
Intelligence Platform**; the primary product is the **SDK**; the existing
Protocol+ICF reviewer becomes the **Interactive Playground** (reference
application). Design language: Stripe/Resend/Vercel/Anthropic Console —
infrastructure, never an EDC.

Guiding constraint: minimal engineering, maximum repositioning. Nothing
working is rewritten; everything is reorganized.

## 1. Sitemap

```
/                      Home — developer platform dashboard        (NEW)
/playground            Interactive Playground (current Home page)  (MOVED)
/playground/reviews/:id            review workspace               (MOVED, unchanged)
/playground/reviews/:id/report     report                         (MOVED, unchanged)
/api-keys              API Keys                                    (NEW)
(hidden)               /health, /health/embeddings                 (ops)
```

## 2. Navigation

Exactly three items, top bar, Stripe-calm:

```
Citera  ◇ Clinical Regulatory Intelligence     Home · Playground · API Keys
```

## 3. Home (wireframe)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Clinical Regulatory Intelligence SDK                                │
│  Embed AI-powered clinical review into any workflow                  │
│  with a single SDK.                                                  │
│  [ Get API key ]   [ Open Playground ]                               │
├──────────────────────────────────────────────────────────────────────┤
│  QUICK START                                                         │
│  $ npm install @citera/sdk                                           │
│  ┌────────────────────────────────────────────────────┐              │
│  │ const citera = new Citera({ apiKey });             │  curl · TS · │
│  │ const review = await citera.reviews.create({       │  Python tabs │
│  │   document: icf.id, protocol: protocol.id,         │              │
│  │   ruleset: "fda" });                       │              │
│  └────────────────────────────────────────────────────┘              │
├──────────────────────────────────────────────────────────────────────┤
│  CAPABILITIES                                                        │
│  ▢ Analyze Protocols      ▢ Review Informed Consent                  │
│  ▢ Cross-document         ▢ Regulatory Evidence                      │
│    Validation             ▢ Compliance Findings                      │
│  ▢ Audit Trail                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  HOW IT WORKS                                                        │
│  Your app ─▶ Citera SDK ─▶ [verify · ground · audit] ─▶ Findings     │
│                                    └▶ every claim span-verified      │
├──────────────────────────────────────────────────────────────────────┤
│  Plan: Free ·  Credits: 4,720 ·  API requests (30d): ▂▄▆█▅           │
│  RECENT ACTIVITY                      QUICK LINKS                    │
│  reviews.create  201  2m ago          Documentation · API Reference  │
│  findings.list   200  2m ago          SDK · Examples                 │
│  documents.upload 201 5m ago                                         │
│  Latest playground sessions → [Consent Form B · 3 findings]          │
└──────────────────────────────────────────────────────────────────────┘
```

## 4. Playground (wireframe — content unchanged, framing new)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⚡ INTERACTIVE PLAYGROUND                                             │
│ Every action below is an SDK call — [view the equivalent code ▸]     │
├──────────────────────────────────────────────────────────────────────┤
│  (the existing wizard: two dropzones · Start review)                 │
│  (the existing reviews list with outcome chips)                      │
└──────────────────────────────────────────────────────────────────────┘
  → /playground/reviews/:id  = the existing workspace, untouched
```

The one addition: a "view code" popover per action showing the SDK call
it just made (`citera.documents.upload(…)`) — the Playground *teaches*
the SDK.

## 5. API Keys (wireframe)

```
┌──────────────────────────────────────────────────────────────────────┐
│ API KEYS                                                             │
│ Plan  Free · credits renew monthly     Billing period  Jul 1–31      │
│ API requests  128 / 5,000              Rate limit  60 rpm            │
├──────────────────────────────────────────────────────────────────────┤
│ CURRENT KEY                                                          │
│ ck_live_a1b2••••••••••7f   created Jul 9   [Reveal] [Rotate] [Delete]│
│ [ + Create key ]                                                     │
├──────────────────────────────────────────────────────────────────────┤
│ USAGE (30 days)   ▁▂▂▄▆█▅▃…                                          │
│ RECENT REQUESTS                                                      │
│ POST /v1/reviews          201   142ms   2m ago                       │
│ GET  /v1/findings/…       200    12ms   2m ago                       │
├──────────────────────────────────────────────────────────────────────┤
│ INSTALL            npm i @citera/sdk · pip install citera            │
│ EXAMPLES           [curl] [TypeScript] [Python]  (tabbed, copyable)  │
│ SUPPORTED MODELS   claude-sonnet-5 (default) · claude-opus-4-8       │
└──────────────────────────────────────────────────────────────────────┘
```

## 6. Developer Onboarding Flow

1. Land on Home → hero + quickstart visible without scrolling.
2. "Get API key" → key auto-provisioned on first visit (Free plan),
   copy in one click.
3. Paste the curl example → first `201` lands in Recent Activity within
   seconds (the aha: *my* request, visible).
4. "Open in Playground" on the created review → inspect findings,
   evidence, dossier visually.
5. Docs links for depth. Target: **first verified finding in five
   minutes.**

## 7. API Resource Model

Resources (nouns only, no implementation leakage):

| Resource | Meaning |
|---|---|
| `Document` | An uploaded clinical document (protocol, ICF, …) |
| `Review` | An evaluation of a document against a ruleset + protocol |
| `Finding` | One evidence-backed result inside a review |
| `Evidence` | The verified material behind a finding |
| `Report` | The exportable, sign-off-ready artifact of a review |
| `Ruleset` | A versioned regulatory rule pack |
| `Study` | (reserved — V2 aggregate; not in v1 surface) |

Never exposed: chunks, embeddings, retrieval scores, prompts, models-as-
mechanics (model is a *setting*, not a concept).

## 8. REST Endpoints (public v1 — aliases of existing internals)

```
POST /v1/documents                      upload (multipart)
GET  /v1/documents · /v1/documents/{id}
POST /v1/reviews                        {document_id, protocol_document_id, ruleset}
GET  /v1/reviews · /v1/reviews/{id}     (findings embedded)
GET  /v1/reviews/{id}/findings/{fid}/evidence
GET  /v1/reviews/{id}/findings/{fid}/audit
GET  /v1/reviews/{id}/report            (html)
GET  /v1/rulesets · /v1/rulesets/{id}
--- platform ---
GET  /v1/usage/summary                  plan, credits, request counts
POST /v1/keys · POST /v1/keys/{id}/rotate · DELETE /v1/keys/{id}
```

Implementation: FastAPI re-includes the existing routers under `/v1`
(one line per router) — the public API *is* the current API.

## 9. SDK Design

```ts
import Citera from "@citera/sdk";
const citera = new Citera({ apiKey: process.env.CITERA_API_KEY });

const protocol = await citera.documents.upload({ file: protocolPdf, kind: "protocol" });
const icf      = await citera.documents.upload({ file: icfPdf, kind: "icf" });

const review = await citera.reviews.create({
  document: icf.id,
  protocol: protocol.id,
  ruleset: "fda",
});

const result = await citera.reviews.waitUntilComplete(review.id);
for (const f of result.findings) {
  console.log(f.status, f.ruleTitle, f.evidence?.quote); // span-verified
}
const html = await citera.reviews.report(review.id);
```

Python mirror: `citera.documents.upload(...)`, `citera.reviews.create(...)`,
`review.wait_until_complete()`. curl examples per endpoint on /api-keys.

## 10. Migration Plan (reuse-max)

| Item | Action | Effort |
|---|---|---|
| Routes/nav | HomePage → /playground; new Home; 3-item nav | S |
| New Home page | static-ish dev-platform page fed by /v1/usage/summary | M |
| API Keys page | new page + `api_keys` table + CRUD + usage counts (from audit_events per day) | M |
| /v1 alias | re-include routers with prefix | S |
| Playground framing | banner + "view code" popovers | S |
| Key **enforcement** | middleware on /v1 | S (fast-follow — page ships first, honest "enforcement rolling out" note until then) |
| npm/PyPI SDK packages | thin fetch wrappers | Stretch (post-hackathon; examples work as raw REST today) |

Nothing deleted; reviewer workspace untouched byte-for-byte.

## 11. Implementation Checklist (order)

1. Route reorg + 3-item nav + Playground banner
2. `/v1` router aliases + `GET /v1/usage/summary`
3. `api_keys` table + CRUD endpoints
4. API Keys page (key mgmt, usage chart, tabbed examples, install, models)
5. New Home (hero, quickstart, capability cards, activity, links)
6. README repositioning ("SDK-first; the reviewer is the Playground")
```
Estimated total: ~1 focused day. Every page reinforces: Citera is
intelligence infrastructure, not document management.
```
