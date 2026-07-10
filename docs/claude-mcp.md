# Claude MCP

## Purpose

Claude MCP is Citera's primary integration: it gives Claude the
Verification Loop. Claude drafts regulatory language; Citera proves
whether Claude is right.

```
Claude → MCP tool → Citera SDK → REST → Verification Engine
```

The MCP server (`packages/mcp`) is a thin adapter — it never
re-evaluates, never re-scores, and never exposes embeddings, retrieval
scores, or prompts. Every verdict comes verbatim from the engine.

## Setup

Build once:

```bash
cd packages/sdk && npm install && npm run build
cd ../mcp && npm install && npm run build
```

**Claude Code**

```bash
claude mcp add citera -- node /path/to/citera/packages/mcp/dist/index.js
```

**Claude Desktop** — Settings → Developer → Edit Config:

```json
{
  "mcpServers": {
    "citera": {
      "command": "node",
      "args": ["/path/to/citera/packages/mcp/dist/index.js"],
      "env": { "CITERA_BASE_URL": "http://localhost:8000" }
    }
  }
}
```

| Env | Default | Purpose |
|---|---|---|
| `CITERA_BASE_URL` | `http://localhost:8000` | Citera API origin |
| `CITERA_API_KEY` | — | Bypasses Public Sandbox limits |
| `CITERA_WEB_URL` | `http://localhost:5173` | Print-ready report links |

## Supported tools

| Tool | Capability |
|---|---|
| `verify_consent` | Verify an Informed Consent Form against its study protocol under a Ruleset — full review, readiness, every Finding with span-verified Evidence (1–3 minutes) |
| `verify_revision` | **The Verification Loop.** Judge proposed replacement language for a failing Finding: `Verified` or `Rejected` with structured reasoning; iterate until Verified |
| `explain_failure` | Reviewer guidance for a Finding: requirement → evidence → why it fails → how to fix it |
| `prepare_submission` | Readiness with the verification overlay: original Findings, Resolved by Verified Revision, remaining blocking issues, final verdict |

Supporting tools: `list_findings` (findings by impact), `list_rulesets`
(available packs), `export_report` (Markdown/JSON report; PDF via the
print-ready page).

## Example conversation

> **User:** Review this consent form against FDA regulations.
> *(Claude calls `verify_consent`)* → Not ready — critical findings.
>
> **User:** Fix the risk section.
> *(Claude drafts, calls `verify_revision`)* → **REJECTED** — 21 CFR
> 50.25(a)(2): foreseeable risks still incomplete; hepatic risk missing.
> *(Claude revises, calls `verify_revision`)* → **VERIFIED** — quote
> span-checked in the revision.
>
> **User:** Is it ready now?
> *(Claude calls `prepare_submission`)* → **Submission Ready** · 100 %
> evidence coverage · 1 requirement Resolved by Verified Revision.

## References

- [Verification Loop](verification-loop.md)
- [`packages/mcp/README.md`](../packages/mcp/README.md)
