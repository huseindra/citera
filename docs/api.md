# API

## Purpose

The REST API is Citera's canonical interface — the Playground, the SDK,
and the Claude MCP server are all clients of it. This page lists the
supported public surface; interactive documentation with request/response
shapes lives in the web app at `/reference`.

## Overview

- Base path: **`/v1`**
- Authentication: `Authorization: Bearer <api-key>` (optional locally;
  bypasses Public Sandbox limits)
- Errors: standard status codes with a human-readable `detail`
- Timestamps: ISO 8601 with an explicit UTC offset
- Long-running work (ingestion, reviews) is asynchronous: create, then
  poll status

## Endpoints

### Documents

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/documents` | Upload a protocol or consent document (`multipart`, `kind=protocol\|icf`); ingestion runs in the background. Identical bytes deduplicate to the same document |
| `GET` | `/v1/documents` | List documents with ingestion status |
| `GET` | `/v1/documents/{id}` | Ingestion status (`processing → ready/failed`) |
| `GET` | `/v1/documents/{id}/text` | Canonical extracted text (what spans index into) |

### Reviews

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/reviews` | Start a review: `{document_id, protocol_document_id, ruleset}` → `202`; poll until `complete` |
| `GET` | `/v1/reviews` | List reviews with finding counts |
| `GET` | `/v1/reviews/{id}` | Full review: status + every Finding with verified Evidence |
| `GET` | `/v1/reviews/{id}/report?format=json\|markdown` | Report with server-computed evidence coverage and readiness |
| `GET` | `/v1/reviews/{id}/submission` | **Submission readiness with the verification overlay** — original Findings, Resolved by Verified Revision, remaining blocking issues |

### Findings & the Verification Loop

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/findings/{id}` | Finding dossier: requirement, Evidence, analysis, audit status |
| `POST` | `/v1/findings/{id}/verify` | **Verify a proposed revision** — `{revised_text}` → `verified`/`rejected` with structured reasoning; append-only, original Finding untouched |

### Rulesets

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/rulesets` | Registry: available / in-development / roadmap packs, versions, aliases |
| `GET` | `/v1/rulesets/{id}` | A pack's rules with statutory references |

### Platform

| Method | Path | Purpose |
|---|---|---|
| `POST/GET/DELETE` | `/v1/keys…` | API key lifecycle (secret shown once, stored hashed) |
| `GET` | `/v1/auth/status` | Whether the presented key is valid |
| `GET` | `/v1/usage/summary` | Plan and recent activity |
| `GET` | `/health` | Liveness + database + embedding provider |

## Fair usage (Public Sandbox)

Unauthenticated public traffic: 3 reviews per rolling 24 h, 1 concurrent
review, 10 MB uploads. Friendly `429`s; API keys lift all limits. Demo
reviews are removed after 24 hours.

## Example

```bash
# 1. upload both documents
curl -s $BASE/v1/documents -F "file=@protocol.pdf" -F "kind=protocol"
curl -s $BASE/v1/documents -F "file=@icf.pdf" -F "kind=icf"

# 2. start an evidence-verified review, then poll
curl -s $BASE/v1/reviews -H "Content-Type: application/json" \
  -d '{"ruleset":"fda","document_id":"<icf>","protocol_document_id":"<protocol>"}'
curl -s $BASE/v1/reviews/<review-id>

# 3. verify a proposed revision for a failing finding
curl -s $BASE/v1/findings/<finding-id>/verify \
  -H "Content-Type: application/json" \
  -d '{"revised_text":"…"}'
```

## References

- Interactive reference: the web app's `/reference` page
- [Verification Loop](verification-loop.md)
