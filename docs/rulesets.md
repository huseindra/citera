# Rulesets — Pluggable Regulatory Intelligence

Citera is a Clinical Regulatory Intelligence SDK. Regulatory requirements are
implemented as interchangeable **Rulesets**. The review engine is completely
jurisdiction-agnostic — it never knows about FDA, HSA, or BPOM; it only loads
Rulesets. Adding a jurisdiction is content work (YAML), never engine work.

Scope v1: **drug clinical trials only** (no devices, diagnostics, or
non-trial biomedical research).

## Registry & lifecycle

`packages/rulesets/src/citera_rulesets/data/registry.yaml` is a thin status
index. Everything else about a ruleset lives in the pack itself.

| Status | Meaning | API behavior |
|---|---|---|
| `available` | Pack shipped and validated | Reviews run |
| `in_development` | Pack shipped & versioned, not yet validated for use | `POST /v1/reviews` → 422, honest message |
| `roadmap` | Planned; registry entry only, no pack | Listed in `GET /v1/rulesets` for the UI |

The loader enforces the lifecycle at startup: an `available`/`in_development`
entry without a pack, or a `roadmap` entry *with* a pack, fails loudly.

### Current registry

| Ruleset | Pack id | Alias | Status | Version | Rules | Languages |
|---|---|---|---|---|---|---|
| FDA 21 CFR Part 50.25 | `fda-21cfr50` | `fda` | available | v1.0.0 | 8 | en |
| HSA — Health Products (Clinical Trials) Regulations 2016, reg 19(1) | `hsa-hpct2016` | `hsa` | available | v1.0.0 | 15 | en |
| BPOM — PerBPOM No. 8 Tahun 2024, Pedoman CUKB 4.8.10 | `bpom-cukb` | `bpom` | available | v1.0.0 | 17 | id, en |
| TGA — National Statement + ICH GCP (dual citation) | `tga-ns-ichgcp` | `tga` | available | v1.0.0 | 16 | en |
| PMDA · EMA · MHRA · Health Canada · NMPA | — | — | roadmap | — | — | — |

Every available pack was validated end-to-end against its own synthetic
sample study (`packages/rulesets/demo-corpus/`) twice: with the scripted
evaluator (CI answer-key tests) and with the live pipeline (Claude +
Voyage embeddings) — including span-grounding round-trips over Bahasa
Indonesia text for BPOM.

Notes on legal grounding (see `docs/rulesets-research.md` for sources):

- **HSA never cites HBRA.** The Human Biomedical Research Act excludes drug
  trials via its own Second Schedule; the correct instrument is the Health
  Products (Clinical Trials) Regulations 2016, reg 19(1)(a)–(u).
- **BPOM is Indonesian-first.** Retrieval queries are written in Bahasa
  Indonesia because the PSP/ICF under review is expected to be Indonesian;
  the pack includes three structural rules beyond 4.8.10 (impartial witness
  4.8.9, participant copy 4.8.11, sponsor insurance/compensation statement
  Ketentuan Umum 17).
- **TGA carries dual citations** for the ICH E6(R2)→E6(R3) transition (both
  acceptable until 13 Jan 2027); each rule's `statutory_refs` lists the R2
  letters and the R3 letters side by side.

## Anatomy of a pack

```
data/<pack-id>/
  ruleset.yaml     # metadata — the pack is fully self-describing
  rules/*.yaml     # one grouped rule per file
```

`ruleset.yaml`:

```yaml
id: hsa-hpct2016
name: Health Products (Clinical Trials) Regulations 2016 — reg 19(1)
version: "0.1.0"          # independent semver per pack
authority: HSA Singapore
jurisdiction: Singapore
coverage: Informed Consent Review — Drug Clinical Trials
languages: [en]           # languages the retrieval queries target
aliases: [hsa]            # accepted by the API: {"ruleset": "hsa"}
```

Each rule:

```yaml
id: hsa-r19-risks
citation: HP(CT) Regs 2016, reg 19(1)(g)     # printed on findings
title: Reasonably foreseeable risks
description: …                                # what the statute requires
retrieval_queries: [ … ]                      # in the pack's language(s)
evaluation_criteria: …                        # what Claude judges against
severity: critical                            # critical | major | minor
statutory_refs:                               # native statutory granularity
  - Health Products (Clinical Trials) Regulations 2016, reg 19(1)(g)
remediation: …                                # static, jurisdiction-authored
```

### Rule granularity

Rules are **grouped at reviewer granularity** (a finding a human reviews),
while `statutory_refs` preserves the **native statutory granularity** — every
provision the rule covers, including dual R2/R3 citations. Users review
findings, not statute numbering; every finding still links back to its
original citations.

`remediation` is static, jurisdiction-authored guidance; it is distinct from
`suggested_revision`, which the engine drafts per finding with Claude.

## Runtime contract

```
POST /v1/reviews
{ "ruleset": "fda", "document_id": …, "protocol_document_id": … }
→ findings + evidence + suggested revisions + audit trail
```

`ruleset` accepts the pack id or its alias (`ruleset_id` remains supported
for backward compatibility). The engine behaves identically regardless of
jurisdiction: retrieve → evaluate → ground → persist, with the same evidence
guarantees. Reviews against a non-`available` ruleset return an honest 422.

## Shipping a new jurisdiction

1. Author the pack (YAML only) with grouped rules + `statutory_refs`.
2. Add a `status: in_development` registry line; the loader validates on start.
3. Build a synthetic sample study pair with planted defects and an answer key.
4. Extend the scripted evaluator for the pack's demo drift; add pack tests.
5. Validate retrieval + evaluation quality (for non-English packs, in the
   pack's language) against the sample pair with the live models.
6. Flip the registry line to `available` and bump the pack version.

No step touches the engine.
