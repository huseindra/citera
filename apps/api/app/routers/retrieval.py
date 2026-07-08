from uuid import UUID

from citera_schemas import RetrievalResult
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Document
from app.services.retrieval import hybrid_search

router = APIRouter(prefix="/retrieval", tags=["retrieval"])


class RetrievalQuery(BaseModel):
    document_id: UUID
    queries: list[str] = Field(min_length=1, max_length=10)
    top_n: int = Field(default=8, ge=1, le=20)


@router.post("/query", response_model=RetrievalResult)
async def retrieval_query(
    body: RetrievalQuery, session: AsyncSession = Depends(get_session)
):
    document = await session.get(Document, body.document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    if document.status != "ready":
        raise HTTPException(
            status_code=409, detail=f"Document is '{document.status}', not ready"
        )
    result = await hybrid_search(
        session, body.document_id, body.queries, top_n=body.top_n
    )
    await session.commit()
    return result
