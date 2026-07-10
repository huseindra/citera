# Architecture

## Purpose

How the Verification Engine works and how its interfaces relate. The
design rule behind everything: **business logic exists exactly once**,
and no interface may show a claim the engine cannot prove.

## Overview

```
        Playground          Claude / AI agents        Applications
             │                       │                      │
             │                 MCP server                   │
             │                (packages/mcp)                │
             │                       │                      │
             │                  Citera SDK                  │
             │               (packages/sdk)                 │
             └───────────────┬───────┴──────────────────────┘
                             │  REST /v1 (canonical)
                             │
                    Verification Engine
              retrieve → evaluate → ground → persist
                             │
                Postgres + pgvector · append-only audit log
```

Every interface returns identical Findings. The MCP server calls only
the SDK; the SDK calls only REST; nothing bypasses a layer.

## The Verification Engine

A review runs per rule, with each rule isolated (one failure never
aborts the review) and committed individually so polling clients see
progress:

1. **Ingest** — extract canonical text (PDF/DOCX/Markdown/plain),
   chunk by section, embed (Voyage). Identical bytes deduplicate by
   content hash.
2. **Retrieve** — hybrid search per rule: dense (pgvector cosine) +
   sparse (Postgres full-text), fused with reciprocal rank fusion.
   Retrieval internals never leave the engine.
3. **Evaluate** — Claude judges the retrieved consent evidence against
   the rule, with the full study protocol as context, through a strict
   tool-forced schema. Produces status, reasoning, a verbatim quote, and
   optionally a suggested revision (always labeled as an AI draft).
4. **Ground** — the span-grounding gate: the quote must round-trip
   byte-for-byte against the canonical text at recorded offsets.
   Failure produces `evaluation_failed` — rejection over hallucination.
5. **Persist** — the Finding, plus append-only audit records for every
   step (extraction, retrieval, prompt, response, grounding,
   persistence).

**Verification** (`POST /v1/findings/{id}/verify`) reuses steps 3–4 on a
candidate revision: the proposed text is the evidence under judgment,
the protocol is the context, and the same gate applies. See
[Verification Loop](verification-loop.md).

## Data model

| Object | Notes |
|---|---|
| Document | Canonical text + page map; status `processing → ready/failed` |
| Chunk | Section-aligned spans with embeddings |
| Review | Immutable once complete; owns Findings |
| Finding | Status, reasoning, verified Evidence (quote + span), suggested revision |
| AuditRecord | Append-only; includes `verify.revision` attempts |
| Ruleset | Not a table — versioned YAML packs loaded at runtime ([Rulesets](rulesets.md)) |

## Design decisions that matter

- **Jurisdiction-agnostic engine.** The engine never mentions FDA or
  BPOM; adding a jurisdiction is pack content, never engine code.
- **Evidence coverage is computed server-side** so every interface
  reports identical readiness (weights: satisfied 100, partial 70,
  conflicting 35, not found 10; unresolved critical Findings always
  block readiness).
- **Reviews are immutable.** Verified revisions overlay a review
  (**Resolved by Verified Revision**); history is never rewritten.
- **Honest failure modes.** In-development Rulesets refuse to run
  (`422`) rather than pretend; unverifiable quotes become
  `evaluation_failed`, not silent success.
- **Tests never call external providers** — a scripted evaluator and
  fake embedder are forced in the test environment; live validation is
  a deliberate act before each Ruleset release.

## References

- [Verification Loop](verification-loop.md) · [Rulesets](rulesets.md) ·
  [API](api.md)
- Historical deep-dives (retrieval tuning, embedding architecture,
  production readiness review): [archive/](archive/)
