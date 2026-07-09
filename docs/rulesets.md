# Multi-Jurisdiction Rulesets

Citera is regulation-agnostic: **every regulatory authority is just a
pluggable ruleset**. FDA is the first implemented pack, not the product.

## Architecture

```
Review Engine (unchanged, jurisdiction-blind)
      ▲ loads by id
Ruleset Registry (registry.yaml — id, authority, jurisdiction, status)
      ▲ available entries map to
Rule Packs (data/<id>/ruleset.yaml + rules/*.yaml — versioned content)
```

- The engine consumes `Rule` objects (citation, criteria, retrieval
  queries, severity). It never contains jurisdiction logic.
- **Adding a jurisdiction = content work, zero engine code**: write a
  rule pack directory, flip its registry entry to `available`. The
  loader hard-fails if the registry claims an unshipped pack.
- Statuses: `available` (runs today) · `preview` (visible in the
  selector, selecting it explains support is in development — never
  faked) · `roadmap` (listed only).
- The same mechanism carries **custom enterprise rulesets** later:
  organization policies and sponsor SOPs are packs with a tenant scope —
  the engine still doesn't change.

## Current registry

| Status | Ruleset |
|---|---|
| ✅ Available | FDA — 21 CFR Part 50.25 (United States, v1.0.0, 8 rules) |
| 🚧 Preview | HSA Singapore (HBRA) · TGA Australia (National Statement + ICH GCP) · BPOM Indonesia (Clinical Trial Guidelines) |
| 🗺 Roadmap | EMA · MHRA · PMDA · Health Canada · NMPA |

## SDK surface

Rulesets are first-class resources; adding jurisdictions never changes
the API shape:

```ts
const review = await client.reviews.create({ protocol, icf, ruleset: "fda-21cfr50" });
// tomorrow, identically:
//   ruleset: "hsa-hbra" | "tga-gcp" | "bpom-ct" | "acme-sop-v2"
```

REST: `GET /v1/rulesets` (registry with status/coverage/version),
`GET /v1/rulesets/{id}` (rules of an available pack). Requests against a
preview ruleset return an honest 422: *"support is currently in
development."*

## Playground selector (wireframe)

```
Ruleset
┌────────────────────────────────┐
│ FDA            [ Available ]   │  ← selected (ring)
│ 21 CFR Part 50.25              │
│ United States · Informed       │
│ Consent Review · v1.0.0 · 8    │
└────────────────────────────────┘
Preview
┌ 🚧 HSA Singapore  [ Preview ] ┐   click → "support is currently
┌ 🚧 TGA Australia  [ Preview ] ┐    in development" note
┌ 🚧 BPOM Indonesia [ Preview ] ┐
Roadmap
( EMA )( MHRA )( PMDA )( Health Canada )( NMPA )
```
