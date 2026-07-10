# Roadmap

## Purpose

What ships next, in order. Short by design — this reflects committed
direction, not brainstorming.

## Near term

1. **Production hardening** — durable review workers (replacing
   in-process background tasks), API-key enforcement on `/v1`,
   pagination and enforced rate limits.
2. **MCP progress notifications** — live progress inside long
   `verify_consent` calls.
3. **Ruleset expansion** — EMA, PMDA, MHRA, Health Canada, NMPA packs,
   each gated by the same live-validation bar as the first four.

## Later

- Document types beyond informed consent (protocol amendments,
  investigator brochures).
- Verification for arbitrary regulatory claims (only once a validated
  judgment path exists — the engine never fakes capability).
- Additional agent integrations (Cursor, OpenAI Agents, LangGraph,
  CrewAI, n8n) on top of the same MCP surface.

## References

- [Overview](overview.md) for current scope
