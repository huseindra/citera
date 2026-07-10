# Hybrid Retrieval

Design notes for the explainable hybrid retrieval layer.

## Goals

- Combine **dense** (semantic) and **sparse** (lexical) search for high recall on regulatory language.
- Make every retrieval decision **explainable**: expose per-source scores, fusion weights, and rank positions.
- Keep results **reproducible**: identical query + index state ⇒ identical results (logged for audit replay).

## Approach

1. **Dense** — embedding similarity search over chunk vectors in Qdrant.
2. **Sparse** — PostgreSQL full-text / BM25-style search over the same chunks.
3. **Fusion** — Reciprocal Rank Fusion (RRF) as the baseline; weights configurable per rule set.
4. **Explainability payload** — each result carries `{dense_score, sparse_score, fused_score, rank, matched_terms}`.

## Explainable Retrieval Contract

Every retrieval response returns, alongside the chunks:

- the exact queries executed (dense text + sparse query string)
- per-retriever scores and ranks
- fusion parameters used
- an audit reference id for replay

## To Decide

- Embedding model choice (see [embeddings.md](embeddings.md))
- Whether to add a cross-encoder reranking stage
- Chunk-level vs section-level retrieval granularity
