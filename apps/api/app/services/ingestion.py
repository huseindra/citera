"""Background ingestion: chunk a document and persist chunks + audit trail.

Runs after the upload response; owns its own session. A document never
stays in 'processing' — every exit path lands on ready or failed.
"""

import logging
from uuid import UUID

from citera_pipeline.ingest import PageRange, chunk_document
from citera_schemas import AuditStep

from app.db import session_factory
from app.models import AuditRecord, Chunk, Document

logger = logging.getLogger(__name__)


async def run_chunking(document_id: UUID) -> None:
    async with session_factory() as session:
        document = await session.get(Document, document_id)
        if document is None:
            logger.error("ingestion: document %s vanished", document_id)
            return
        try:
            page_map = (
                [PageRange(**p) for p in document.page_map["pages"]]
                if document.page_map
                else None
            )
            chunks = chunk_document(document.canonical_text, document.id, page_map)
            for chunk in chunks:
                session.add(
                    Chunk(
                        id=chunk.id,
                        document_id=document.id,
                        text=chunk.text,
                        page=chunk.span.page,
                        char_start=chunk.span.char_start,
                        char_end=chunk.span.char_end,
                        section_title=chunk.section_title,
                        content_hash=chunk.content_hash,
                    )
                )
            session.add(
                AuditRecord(
                    step=AuditStep.INGEST_CHUNK,
                    document_id=document.id,
                    payload={
                        "chunk_count": len(chunks),
                        "sections": sorted(
                            {c.section_title for c in chunks if c.section_title}
                        ),
                        "max_chunk_chars": max((len(c.text) for c in chunks), default=0),
                    },
                )
            )
            document.status = "ready"
        except Exception as exc:
            logger.exception("ingestion failed for document %s", document_id)
            document.status = "failed"
            document.status_reason = f"{type(exc).__name__}: {exc}"
        await session.commit()
