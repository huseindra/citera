# Deployment

## Purpose

How to run Citera locally for development and demos, and what a
production deployment needs.

## Requirements

- Docker (Postgres 16 + pgvector)
- Python 3.12 with [uv](https://docs.astral.sh/uv/)
- Node 18+ (web, SDK, MCP)
- API keys: `ANTHROPIC_API_KEY` (Claude) and `VOYAGE_API_KEY`
  (embeddings)

## Environment

Create `.env` at the repository root (loaded by the API):

```bash
ANTHROPIC_API_KEY=sk-ant-…
VOYAGE_API_KEY=pa-…
CLAUDE_MODEL=claude-opus-4-8        # evaluator model
DATABASE_URL=postgresql+asyncpg://citera:citera@localhost:5433/citera
```

Without keys, the API refuses to start review work with live providers;
tests always run with fake/scripted providers and never call external
APIs.

## Run locally

```bash
make db     # Postgres + pgvector on port 5433 (docker compose)
make api    # FastAPI on :8000 (run from the repo root — it loads ./.env)
make web    # Playground on :5173
make seed   # optional: seed the demo review
make test   # Python test suite (no external calls)
```

Open http://localhost:5173 — the Playground loads sample studies with no
uploads required.

## Claude MCP

See [Claude MCP](claude-mcp.md). The MCP server is a local Node process
speaking stdio; point `CITERA_BASE_URL` at the running API.

## Production notes

The hackathon deployment is intentionally lightweight. Before hosting
publicly:

- Terminate behind a reverse proxy that sets `X-Forwarded-For` — the
  Public Sandbox limits key on it (loopback traffic is treated as local
  development and never limited).
- Review jobs run in-process (`BackgroundTasks`); a durable worker queue
  is the first production hardening step.
- API keys are issued and hashed; enable enforcement before exposing
  `/v1` beyond trusted networks.

## References

- [Architecture](architecture.md)
- `docker-compose.yml`, `Makefile` at the repository root
