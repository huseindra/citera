# Embeddings

Design notes for the embedding pipeline.

## Goals

- Represent clinical and regulatory text chunks as vectors suitable for semantic retrieval.
- Version everything: model id, dimensions, and preprocessing are recorded per chunk so retrieval is reproducible.

## Pipeline

```
Chunk → Preprocess (normalize, strip artifacts) → Embed → Store (Qdrant) + metadata (PostgreSQL)
```

## Requirements

- **Model versioning** — a chunk's vector is only comparable within the same model version; re-embedding is a tracked migration.
- **Metadata** — each vector stores `{document_id, chunk_id, section, page, model_version, created_at}`.
- **Batch + incremental** — full-document ingestion and single-chunk updates both supported.

## To Decide

- Embedding model (hosted API vs local model)
- Chunking strategy interplay (size, overlap, section-aware boundaries)
- Dimensionality / quantization trade-offs in Qdrant
