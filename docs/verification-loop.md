# Verification Loop

## Purpose

The Verification Loop is Citera's core workflow: it turns a failing
regulatory requirement into a **Submission Ready** verdict through
verified iteration.

```
Claude proposes replacement language
        ↓
Citera verifies              → REJECTED (which regulation still fails, why)
        ↓
Claude revises
        ↓
Citera verifies              → VERIFIED (evidence span-checked in the revision)
        ↓
prepare_submission           → Submission Ready
```

## Overview

A full review judges a consent document against every rule in a Ruleset.
When a Finding fails (`partial`, `conflicting`, `not_found`), the loop
takes over:

1. **`explain_failure`** — reviewer guidance: what the regulation
   requires, what the document currently says (span-verified), why it
   fails, what the protocol documents, and how to fix it.
2. **`verify_revision`** — submit proposed replacement text for that
   Finding. The engine judges it with the **exact same evaluator,
   protocol context, and span-grounding gate** as a full review, and
   returns `Verified` or `Rejected` with structured reasoning.
3. Repeat until Verified.
4. **`prepare_submission`** — readiness with the verification overlay:
   original Findings (immutable), revisions proven through the loop, and
   any remaining blocking issues. When nothing blocks: **Submission
   Ready**.

## Architecture

- **Same judgment path.** The candidate revision is passed to the
  evaluator as the evidence under judgment, with the already-ingested
  study protocol as context. No second model, no separate rubric —
  verification inherits the path each Ruleset was live-validated on.
- **Grounding gate, unchanged.** A `Verified` verdict may only carry a
  quote that round-trips byte-for-byte against the submitted revision.
  An ungroundable quote can never produce `Verified`.
- **Immutability.** The original review is never rewritten. Every
  attempt is an append-only `verify.revision` audit record; a passing
  revision appears in `prepare_submission` as an explicit
  **"Resolved by Verified Revision"** overlay. The latest attempt per
  Finding wins — a later rejected attempt un-resolves it.
- **Speed.** One verification is a single retrieval over cached
  embeddings plus one evaluator call (~5–15 s), so the loop is
  interactive.

## Example

Via REST:

```bash
POST /v1/findings/{finding_id}/verify
{ "revised_text": "The following risks of Centraxol have been identified…" }

→ { "verdict": "verified", "status": "satisfied",
    "verified_quote": "…", "attempt": 2, … }

GET /v1/reviews/{review_id}/submission
→ { "verdict": "Submission Ready",
    "resolved_by_revision": [ … ],
    "remaining_actions": [] }
```

Via Claude (MCP): ask Claude to fix a failing section — it calls
`verify_revision`, reads the rejection reasoning, revises, and resubmits
until Verified. See [Claude MCP](claude-mcp.md).

## References

- [Architecture](architecture.md) — where verification sits in the engine
- [API](api.md) — endpoint details
