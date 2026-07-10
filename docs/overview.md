# Overview

## Purpose

Citera exists because large language models will happily produce
compliant-*sounding* clinical documents, and in regulated clinical
research, compliant-sounding is not enough. A consent form that
understates a documented hepatotoxicity risk can suspend a study.
Citera makes AI usable in this domain by inverting the roles:

> **Claude proposes. Citera verifies.**

Citera is not an AI reviewer that generates opinions. It is a
**Verification Engine** that proves — with span-verified evidence and a
replayable audit trail — whether a document satisfies each regulatory
requirement.

## Who it is for

- **Regulatory affairs and quality teams** (CROs, sponsors, sites) who
  must defend every review decision during audits.
- **Healthcare AI developers** who need a trust layer before their
  AI-drafted documents reach a submission.
- **Claude users** — through Claude MCP, Claude gains the ability to
  draft regulatory language and *prove* it compliant, iteratively.

## What makes it different

1. **Rejection over hallucination.** Every evidence quote must round-trip
   byte-for-byte against the source document at recorded character
   offsets. A quote that cannot be located is rejected, never shown.
2. **Findings, not answers.** Each requirement produces a Finding with a
   status (`satisfied`, `partial`, `conflicting`, `not_found`,
   `evaluation_failed`), reasoning, verified Evidence, and the statutory
   citation.
3. **Cross-document verification.** The consent form is judged against
   the study protocol — contradictions (an ICF claiming "well tolerated"
   while the protocol documents serious risks) are first-class results.
4. **The Verification Loop.** Failing requirements are not dead ends:
   propose replacement language, and the engine verifies it with the
   same judgment path — until the review is **Submission Ready**. See
   [Verification Loop](verification-loop.md).
5. **Append-only audit.** Every pipeline step — extraction, retrieval,
   evaluation, grounding, verification attempts — is recorded and
   replayable. The review itself is immutable.

## The surfaces

One engine, multiple interfaces — every interface returns identical
Findings:

- **Playground** — the interactive reviewer workspace (public sandbox,
  no signup).
- **Claude MCP** — the primary integration: the Verify Loop inside
  Claude. See [Claude MCP](claude-mcp.md).
- **REST API** — the canonical interface. See [API](api.md).

## Scope

v1 verifies **informed consent documents for drug clinical trials**
against jurisdiction-specific Rulesets: FDA (US), HSA (Singapore),
BPOM (Indonesia, Bahasa Indonesia supported), TGA (Australia). See
[Rulesets](rulesets.md).

## References

- [Architecture](architecture.md)
- [Verification Loop](verification-loop.md)
- Demo corpora are fully synthetic — no real clinical data anywhere in
  this repository.
