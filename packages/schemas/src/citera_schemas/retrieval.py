from uuid import UUID

from pydantic import BaseModel

from citera_schemas.evidence import EvidenceSpan


class RetrievedChunk(BaseModel):
    """One retrieved chunk with its full explainability payload.

    A score is None (not 0.0) when the chunk was absent from that
    retriever's result list — absence and zero relevance are different facts.
    """

    chunk_id: UUID
    text: str
    span: EvidenceSpan
    section_title: str | None = None
    dense_score: float | None = None
    sparse_score: float | None = None
    fused_score: float
    rank: int
    matched_terms: list[str] = []


class RetrievalResult(BaseModel):
    """Everything needed to explain and replay one retrieval call."""

    queries_executed: list[str]
    fusion_params: dict[str, float | int]
    results: list[RetrievedChunk]
    audit_record_id: UUID | None = None
