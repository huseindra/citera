import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DDL, Computed, ForeignKey, Index, Text, event, func
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.settings import settings


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    filename: Mapped[str]
    kind: Mapped[str]  # icf | protocol | other
    content_hash: Mapped[str] = mapped_column(index=True)
    # Canonical text: the single reference all evidence spans index into.
    canonical_text: Mapped[str] = mapped_column(Text)
    page_map: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(default="pending")  # pending|processing|ready|failed
    status_reason: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    text: Mapped[str] = mapped_column(Text)
    page: Mapped[int | None]
    char_start: Mapped[int]
    char_end: Mapped[int]
    section_title: Mapped[str | None]
    content_hash: Mapped[str] = mapped_column(index=True)
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(settings.embedding_dim), nullable=True
    )
    embedding_model: Mapped[str | None]
    embedding_version: Mapped[str | None]
    # sparse index maintained by Postgres itself — no sync code to forget
    tsv = mapped_column(
        TSVECTOR,
        Computed("to_tsvector('english', text)", persisted=True),
        nullable=True,
    )


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    protocol_document_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )
    ruleset_id: Mapped[str]
    ruleset_version: Mapped[str]
    status: Mapped[str] = mapped_column(default="pending")  # pending|running|complete|failed
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    review_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reviews.id", ondelete="CASCADE"), index=True
    )
    rule_id: Mapped[str]
    status: Mapped[str]
    reasoning: Mapped[str] = mapped_column(Text)
    verbatim_quote: Mapped[str | None] = mapped_column(Text)
    page: Mapped[int | None]
    char_start: Mapped[int | None]
    char_end: Mapped[int | None]
    evidence_strength: Mapped[str | None]
    protocol_reference: Mapped[str | None] = mapped_column(Text)
    queries_executed: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # links the finding to the audit record of the retrieval that fed it
    retrieval_audit_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(default="Default key")
    # display prefix only; the secret is stored as a hash and shown once
    prefix: Mapped[str]
    key_hash: Mapped[str] = mapped_column(index=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    revoked_at: Mapped[datetime | None]
    last_used_at: Mapped[datetime | None]


class AuditRecord(Base):
    __tablename__ = "audit_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    step: Mapped[str] = mapped_column(index=True)
    payload: Mapped[dict] = mapped_column(JSONB)
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    review_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    finding_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


Index("ix_chunks_doc_span", Chunk.document_id, Chunk.char_start)
Index("ix_chunks_tsv", Chunk.tsv, postgresql_using="gin")

# Auditability is enforced by the database, not by convention: any UPDATE or
# DELETE on audit_records raises. Dropping the table (seed reset) still works.
# One DDL statement per event: asyncpg rejects multi-command prepared statements.
_immutability_statements = [
    """
    CREATE OR REPLACE FUNCTION audit_records_immutable() RETURNS trigger AS $$
    BEGIN
        RAISE EXCEPTION 'audit_records is append-only';
    END;
    $$ LANGUAGE plpgsql
    """,
    "DROP TRIGGER IF EXISTS trg_audit_records_immutable ON audit_records",
    """
    CREATE TRIGGER trg_audit_records_immutable
        BEFORE UPDATE OR DELETE ON audit_records
        FOR EACH ROW EXECUTE FUNCTION audit_records_immutable()
    """,
]
for _stmt in _immutability_statements:
    event.listen(AuditRecord.__table__, "after_create", DDL(_stmt))
