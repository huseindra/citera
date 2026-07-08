"""Hybrid retrieval: pgvector dense + Postgres FTS sparse + RRF.

Every call writes an audit record and returns the full explainability
payload — queries executed, per-chunk scores, fusion params.
"""

import re
from uuid import UUID

from citera_pipeline.retrieve import fuse
from citera_pipeline.retrieve.rrf import DEFAULT_K, DEFAULT_TOP_N
from citera_schemas import (
    AuditStep,
    EvidenceSpan,
    RetrievalResult,
    RetrievedChunk,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditRecord, Chunk
from app.services.embeddings import get_embedder

_CANDIDATES_PER_QUERY = 20
_WORD = re.compile(r"[A-Za-z0-9]{3,}")
# keep matched_terms meaningful for reviewers; Postgres drops these anyway
_STOPWORDS = frozenset(
    "and the for you your are was were this that with from will may any what".split()
)


async def hybrid_search(
    session: AsyncSession,
    document_id: UUID,
    queries: list[str],
    *,
    top_n: int = DEFAULT_TOP_N,
    review_id: UUID | None = None,
) -> RetrievalResult:
    embedder = get_embedder()
    query_vectors = await embedder.embed(queries, input_type="query")

    dense_lists = [
        await _dense_search(session, document_id, vec) for vec in query_vectors
    ]
    sparse_lists = [
        await _sparse_search(session, document_id, q) for q in queries
    ]

    fused = fuse(dense_lists, sparse_lists, top_n=top_n)
    fusion_params = {
        "k": DEFAULT_K,
        "top_n": top_n,
        "num_queries": len(queries),
        "candidates_per_query": _CANDIDATES_PER_QUERY,
    }

    rows = {}
    if fused:
        result = await session.scalars(
            select(Chunk).where(Chunk.id.in_([f.chunk_id for f in fused]))
        )
        rows = {c.id: c for c in result}

    terms = _query_terms(queries)
    results = [
        RetrievedChunk(
            chunk_id=f.chunk_id,
            text=rows[f.chunk_id].text,
            span=EvidenceSpan(
                document_id=document_id,
                page=rows[f.chunk_id].page,
                char_start=rows[f.chunk_id].char_start,
                char_end=rows[f.chunk_id].char_end,
            ),
            section_title=rows[f.chunk_id].section_title,
            dense_score=f.dense_score,
            sparse_score=f.sparse_score,
            fused_score=f.fused_score,
            rank=f.rank,
            matched_terms=_matched_terms(rows[f.chunk_id].text, terms),
        )
        for f in fused
    ]

    audit = AuditRecord(
        step=AuditStep.RETRIEVE,
        document_id=document_id,
        review_id=review_id,
        payload={
            "queries": queries,
            "fusion_params": fusion_params,
            "embedding_model": f"{embedder.model}@{embedder.version}",
            "results": [
                {
                    "chunk_id": str(r.chunk_id),
                    "dense_score": r.dense_score,
                    "sparse_score": r.sparse_score,
                    "fused_score": r.fused_score,
                    "rank": r.rank,
                }
                for r in results
            ],
        },
    )
    session.add(audit)
    await session.flush()

    return RetrievalResult(
        queries_executed=queries,
        fusion_params=fusion_params,
        results=results,
        audit_record_id=audit.id,
    )


async def _dense_search(
    session: AsyncSession, document_id: UUID, query_vector: list[float]
) -> list[tuple[UUID, float]]:
    distance = Chunk.embedding.cosine_distance(query_vector)
    rows = await session.execute(
        select(Chunk.id, (1 - distance).label("score"))
        .where(Chunk.document_id == document_id, Chunk.embedding.is_not(None))
        .order_by(distance)
        .limit(_CANDIDATES_PER_QUERY)
    )
    return [(row.id, float(row.score)) for row in rows]


async def _sparse_search(
    session: AsyncSession, document_id: UUID, query: str
) -> list[tuple[UUID, float]]:
    # OR the terms: websearch_to_tsquery ANDs plain words, which returns
    # nothing for natural-phrase rule queries. Recall from OR, order from
    # ts_rank.
    words = _WORD.findall(query)
    if not words:
        return []
    tsquery = func.websearch_to_tsquery("english", " OR ".join(words))
    score = func.ts_rank(Chunk.tsv, tsquery)
    rows = await session.execute(
        select(Chunk.id, score.label("score"))
        .where(Chunk.document_id == document_id, Chunk.tsv.op("@@")(tsquery))
        .order_by(score.desc(), Chunk.id)
        .limit(_CANDIDATES_PER_QUERY)
    )
    return [(row.id, float(row.score)) for row in rows]


def _query_terms(queries: list[str]) -> list[str]:
    seen: dict[str, None] = {}
    for query in queries:
        for word in _WORD.findall(query.lower()):
            if word not in _STOPWORDS:
                seen.setdefault(word)
    return list(seen)


def _matched_terms(text: str, terms: list[str], cap: int = 10) -> list[str]:
    lowered = text.lower()
    return [t for t in terms if t in lowered][:cap]
