from uuid import UUID

from pydantic import BaseModel

from citera_schemas.evidence import EvidenceSpan


class Chunk(BaseModel):
    id: UUID
    document_id: UUID
    text: str
    span: EvidenceSpan
    section_title: str | None = None
    content_hash: str
    embedding_model: str | None = None
    embedding_version: str | None = None
