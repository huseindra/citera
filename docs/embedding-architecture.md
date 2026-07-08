# Embedding Architecture

**Source of truth** for the embedding layer. Storage is **PostgreSQL +
pgvector** (locked decision — Qdrant deliberately not used: vectors,
sparse index, findings, and the audit log live in one ACID store).

## Provider abstraction

```
Ingestion / Retrieval  ──►  Embedder protocol
                            (embed(texts, input_type) · model · version ·
                             dim · health_check())
                                    │ wrapped by CachingEmbedder
        ┌───────────────┬──────────┴────────────────────────────┐
   FakeEmbedder    VoyageEmbedder                OpenAICompatEmbedder
   (tests/offline) (input_type is a request      (base_url + model + key)
                    field, not a prefix)          one class → many providers:
                                                  ollama · tei · openai · jina
                                                  · any /v1/embeddings server
```

Retrieval and ingestion depend only on the protocol via `get_embedder()`.
No retrieval logic knows which provider generated a vector.

## Configuration — always explicit, never probed

```
EMBEDDING_PROVIDER=ollama        # fake | voyage | ollama | tei | openai | jina | openai-compat
EMBEDDING_MODEL=bge-m3           # provider and model are separate concerns
EMBEDDING_DIM=1024
EMBEDDING_BASE_URL=              # optional preset override
EMBEDDING_API_KEY=               # for paid providers
```

- Automatic provider selection does not exist. `auto` fails fast with an
  actionable error.
- Startup runs `health_check()` on the configured provider; an unreachable
  or dimension-mismatched provider **aborts boot** — failures are visible
  before the first review, never during one.
- Task prefixes some models need (e.g. nomic's `search_query:`) are applied
  inside the provider from `input_type`; callers never know about them.

### Local-first deployment

| Environment | Recommended | Why |
|---|---|---|
| Dev / demo (macOS) | **BGE-M3 via Ollama** (`ollama pull bge-m3`) | 1024-d (matches the column), Metal-accelerated, zero Python deps |
| Production | **HuggingFace TEI** (Docker) | batching, GPU, metrics |
| No local runtime | Voyage (or OpenAI/Jina) | rate limits apply — see reliability |

Note: `nomic-embed-text` is 768-d — switching to it requires recreating
the vector column (EMBEDDING_DIM) and reindexing.

## Caching strategy

- **Persistent document cache** = the `chunks.embedding` column itself;
  re-uploading identical bytes never re-embeds (document-level dedup).
- **In-process `CachingEmbedder`** keyed by `(input_type, text)` with LRU
  bound + hit/miss stats: static rule queries are embedded once per
  process; `run_review` pre-warms all rule queries in ONE batched call.
- E3 adds cross-document reuse keyed by `(content_hash, model)`.

## Reliability

- Rate limits (429): patient Retry-After-aware exponential backoff (up to
  7 attempts / 45s cap), separate from the 3-attempt budget for generic
  failures. One shared `httpx.AsyncClient` per provider instance
  (connection reuse).
- **Vector-space guard** (E2): retrieval verifies chunk `embedding_model`
  matches the active model; a mismatch skips dense and degrades to
  sparse-only with an audit note — different spaces are never compared
  silently.
- **Degradation, not cross-provider fallback** (E2): falling back to a
  different model would compare incompatible spaces. When the provider is
  down at query time, retrieval runs sparse-only (FTS + RRF) and records
  the degradation in the audit log.

## Reproducibility

Every `ingest.embed` and `retrieve` audit record carries
`{provider, model, dim, version}`. Startup diagnostics are exposed at
`GET /health` (boot snapshot) and `GET /health/embeddings` (live check +
cache stats).

## Migration strategy

| Increment | Content | Status |
|---|---|---|
| E1 | Provider abstraction, explicit config, fail-fast startup, diagnostics, audit metadata, this document | shipped |
| E2 | Vector-space guard + sparse-only degradation | planned |
| E3 | Cross-document embedding reuse + `scripts/reindex_embeddings.py` for model switches | planned |
| E4 | Full provider contract-test matrix (httpx MockTransport — no external APIs in tests) | planned |

Switching providers/models in operation: change the env vars → restart
(fail-fast validates) → run the reindex script (E3) so stored vectors and
queries share one space. Never mix spaces; the guard (E2) enforces this.
