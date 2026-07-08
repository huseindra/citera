import hashlib
from dataclasses import asdict
from datetime import datetime
from typing import Literal
from uuid import UUID

from citera_pipeline.ingest import (
    EmptyDocumentError,
    ExtractionError,
    UnsupportedFileTypeError,
    extract,
)
from citera_schemas import AuditStep
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    Form,
    HTTPException,
    Response,
    UploadFile,
)
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import AuditRecord, Chunk, Document
from app.services.ingestion import run_chunking

router = APIRouter(prefix="/documents", tags=["documents"])

DocumentKind = Literal["icf", "protocol", "other"]


class DocumentOut(BaseModel):
    id: UUID
    filename: str
    kind: str
    status: str
    status_reason: str | None
    chunk_count: int
    created_at: datetime


async def _to_out(session: AsyncSession, doc: Document) -> DocumentOut:
    chunk_count = await session.scalar(
        select(func.count()).select_from(Chunk).where(Chunk.document_id == doc.id)
    )
    return DocumentOut(
        id=doc.id,
        filename=doc.filename,
        kind=doc.kind,
        status=doc.status,
        status_reason=doc.status_reason,
        chunk_count=chunk_count or 0,
        created_at=doc.created_at,
    )


@router.post("", response_model=DocumentOut, status_code=201)
async def upload_document(
    background: BackgroundTasks,
    response: Response,
    file: UploadFile,
    kind: DocumentKind = Form("other"),
    session: AsyncSession = Depends(get_session),
):
    data = await file.read()
    filename = file.filename or "upload"
    try:
        extraction = extract(filename, data)
    except UnsupportedFileTypeError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except EmptyDocumentError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ExtractionError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc

    content_hash = hashlib.sha256(data).hexdigest()
    existing = await session.scalar(
        select(Document).where(Document.content_hash == content_hash)
    )
    if existing is not None:
        # Same bytes → same document; no duplicate chunks are ever created.
        response.status_code = 200
        return await _to_out(session, existing)

    document = Document(
        filename=filename,
        kind=kind,
        content_hash=content_hash,
        canonical_text=extraction.canonical_text,
        page_map=(
            {"pages": [asdict(p) for p in extraction.page_map]}
            if extraction.page_map
            else None
        ),
        status="processing",
    )
    session.add(document)
    await session.flush()
    session.add(
        AuditRecord(
            step=AuditStep.INGEST_EXTRACT,
            document_id=document.id,
            payload={
                "filename": filename,
                "kind": kind,
                "bytes": len(data),
                "content_hash": content_hash,
                "pages": len(extraction.page_map) if extraction.page_map else None,
            },
        )
    )
    await session.commit()

    background.add_task(run_chunking, document.id)
    return await _to_out(session, document)


@router.get("", response_model=list[DocumentOut])
async def list_documents(session: AsyncSession = Depends(get_session)):
    docs = (
        await session.scalars(select(Document).order_by(Document.created_at.desc()))
    ).all()
    return [await _to_out(session, d) for d in docs]


@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(
    document_id: UUID, session: AsyncSession = Depends(get_session)
):
    doc = await session.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return await _to_out(session, doc)


class DocumentText(BaseModel):
    id: UUID
    filename: str
    canonical_text: str


class SemanticPoint(BaseModel):
    chunk_id: UUID
    x: float
    y: float
    section_title: str | None
    char_start: int
    char_end: int
    preview: str


class SemanticMapOut(BaseModel):
    document_id: UUID
    points: list[SemanticPoint]


@router.get("/{document_id}/semantic-map", response_model=SemanticMapOut)
async def get_semantic_map(
    document_id: UUID, session: AsyncSession = Depends(get_session)
):
    """2D PCA projection of the document's chunk embeddings. Fewer than
    3 embedded chunks yields an empty map (the UI hides the panel)."""
    from citera_pipeline.semantic import project_2d

    doc = await session.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    chunks = (
        await session.scalars(
            select(Chunk)
            .where(Chunk.document_id == document_id, Chunk.embedding.is_not(None))
            .order_by(Chunk.char_start)
        )
    ).all()

    coords = project_2d([list(c.embedding) for c in chunks])
    points = [
        SemanticPoint(
            chunk_id=chunk.id,
            x=x,
            y=y,
            section_title=chunk.section_title,
            char_start=chunk.char_start,
            char_end=chunk.char_end,
            preview=chunk.text[:120],
        )
        for chunk, (x, y) in zip(chunks, coords)
    ]
    return SemanticMapOut(document_id=document_id, points=points)


@router.get("/{document_id}/text", response_model=DocumentText)
async def get_document_text(
    document_id: UUID, session: AsyncSession = Depends(get_session)
):
    doc = await session.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentText(
        id=doc.id, filename=doc.filename, canonical_text=doc.canonical_text
    )
