# @citera/mcp

MCP server for **Citera — Clinical Regulatory Intelligence**.

Exposes the Review Engine to Claude Desktop, Claude Code, and any MCP
client. A thin adapter over [`@citera/sdk`](../sdk): it never re-evaluates,
never re-scores, and returns the exact same findings as the Playground and
the REST API.

```
Claude → MCP tool → @citera/sdk → REST → Review Engine
```

## The Verify Loop

Claude proposes; Citera verifies. Claude revises; Citera proves.

```
Claude drafts consent language
  → verify_revision()  → REJECTED (which regulation fails, what's missing)
  → Claude rewrites
  → verify_revision()  → VERIFIED (quote span-checked in the revision)
  → prepare_submission() → Submission Ready
```

Every attempt is an append-only audit record; the original review is
immutable — passing revisions appear as an explicit
"Resolved by Verified Revision" overlay.

## Tools

| Tool | What it does |
|---|---|
| `review_documents` | Review a protocol + ICF against a ruleset; returns readiness, evidence matrix, findings |
| `verify_revision` | **The Verify Loop** — judge proposed replacement language against a failing requirement; Verified or Rejected with structured reasoning |
| `explain_failure` | Why a requirement fails: requirement → evidence → reason → suggested direction |
| `prepare_submission` | Submission readiness with the verification overlay + remaining actions + final verdict |
| `list_findings` | All findings of a review grouped by impact (Critical / Medium / Low) |
| `list_rulesets` | Rulesets grouped by status: available / in development / roadmap |
| `export_report` | Report as Markdown or JSON; PDF via the print-ready report page |

## Setup

```bash
cd packages/sdk && npm install && npm run build
cd ../mcp && npm install && npm run build
```

### Claude Desktop / Claude Code

```json
{
  "mcpServers": {
    "citera": {
      "command": "node",
      "args": ["/path/to/citera/packages/mcp/dist/index.js"],
      "env": {
        "CITERA_BASE_URL": "http://localhost:8000",
        "CITERA_API_KEY": "sk-citera-…"
      }
    }
  }
}
```

Claude Code: `claude mcp add citera -- node /path/to/citera/packages/mcp/dist/index.js`

## Example

> **User:** Review this informed consent form against FDA regulations.
>
> Claude calls `review_documents(protocol_text=…, icf_text=…, ruleset="fda")`
> and explains the compliance issues — every quote span-verified by the
> engine, every suggested revision labeled as an AI draft.

## Configuration

| Env | Default | |
|---|---|---|
| `CITERA_BASE_URL` | `http://localhost:8000` | Citera API origin |
| `CITERA_API_KEY` | — | Bearer token for `/v1` |
| `CITERA_WEB_URL` | `http://localhost:5173` | Playground origin (print-ready PDF links) |
