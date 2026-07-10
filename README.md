# Citera

Clinical Regulatory Intelligence Infrastructure that verifies
AI-generated regulatory documents using evidence-backed reasoning.

> **Claude proposes. Citera verifies.**

Large language models will happily write compliant-*sounding* clinical
documents. In regulated clinical research, compliant-sounding gets
studies suspended. Citera is the trust layer: a Verification Engine that
proves — with span-verified evidence and a replayable audit trail —
whether a document satisfies each regulatory requirement, and verifies
proposed fixes until the submission is ready.

All demo corpora in this repository are fully synthetic — no real
clinical data anywhere.

## Features

- **Playground** — interactive reviewer workspace; public sandbox, no
  signup, sample studies included
- **Verification Loop** — failing requirements become Submission Ready
  through verified iteration
- **Claude MCP** — the Verification Loop inside Claude Desktop and
  Claude Code
- **REST API** — the canonical interface for applications and workflows
- **Evidence-backed Findings** — every quote round-trips byte-for-byte
  against the source document; unverifiable claims are rejected, never
  shown
- **Rulesets** — regulations as pluggable, versioned packs: FDA (US),
  HSA (Singapore), BPOM (Indonesia, Bahasa Indonesia), TGA (Australia)

## Architecture

```
Claude / Playground / Applications
        ↓
   MCP  ·  Web  ·  SDK
        ↓
     REST /v1 (canonical)
        ↓
  Verification Engine
  retrieve → evaluate → ground → persist
        ↓
  Postgres + pgvector · append-only audit log
```

Business logic exists exactly once. Every interface returns identical
Findings. Details: [docs/architecture.md](docs/architecture.md).

## Quick Start

Requirements: Docker, Python 3.12 + [uv](https://docs.astral.sh/uv/),
Node 18+.

```bash
# 1. environment — create .env at the repo root
ANTHROPIC_API_KEY=sk-ant-…
VOYAGE_API_KEY=pa-…
CLAUDE_MODEL=claude-opus-4-8

# 2. backend
make db     # Postgres + pgvector (port 5433)
make api    # FastAPI on :8000

# 3. frontend
make web    # Playground on :5173
```

Open http://localhost:5173, pick a sample study, and run a review — no
uploads required. `make test` runs the full suite (never calls external
APIs).

## Verification Loop

```
Claude proposes replacement language
        ↓
Citera verifies      → Rejected (which regulation still fails, why)
        ↓
Claude revises
        ↓
Citera verifies      → Verified (evidence span-checked in the revision)
        ↓
Submission Ready
```

The original review is immutable; verified revisions appear as an
explicit **Resolved by Verified Revision** overlay, and every attempt is
recorded in the audit trail. Details:
[docs/verification-loop.md](docs/verification-loop.md).

## Claude MCP

```bash
cd packages/sdk && npm install && npm run build
cd ../mcp && npm install && npm run build
claude mcp add citera -- node "$PWD/dist/index.js"
```

Then, inside Claude: *"Review this consent form against FDA
regulations."* Supported tools: `verify_consent`, `verify_revision`,
`explain_failure`, `prepare_submission`. Setup and examples:
[docs/claude-mcp.md](docs/claude-mcp.md).

## Documentation

Start at [docs/](docs/README.md): overview, architecture, the
Verification Loop, Claude MCP, Rulesets, API, deployment, roadmap.

## Roadmap

Production hardening (durable workers, key enforcement), MCP progress
notifications, and further Ruleset packs (EMA, PMDA, MHRA, Health
Canada, NMPA) — see [docs/roadmap.md](docs/roadmap.md).

## Contributing

- `make test` must pass; tests never depend on external APIs.
- New Rulesets are YAML packs (`packages/rulesets`) and must reproduce
  their planted-defect answer key against live Claude before release.
- Keep the layering: MCP → SDK → REST → engine, no bypasses; never
  expose retrieval scores, embeddings, or prompts to users.

Bug reports and feature requests: GitHub Issues.

## License

[MIT](LICENSE).

## Contact

Husein Indra Kusuma — Founder · husein@monago.io
