from datetime import datetime
from uuid import UUID

from citera_rulesets import RulesetError, load_ruleset
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Document, Finding, Review
from app.services.review import run_review

router = APIRouter(prefix="/reviews", tags=["reviews"])


class ReviewCreate(BaseModel):
    document_id: UUID
    protocol_document_id: UUID
    ruleset_id: str = "fda-21cfr50"


class SpanOut(BaseModel):
    page: int | None
    char_start: int
    char_end: int


class FindingOut(BaseModel):
    id: UUID
    rule_id: str
    rule_title: str | None
    citation: str | None
    severity: str | None
    status: str
    reasoning: str
    verbatim_quote: str | None
    span: SpanOut | None
    evidence_strength: str | None
    protocol_reference: str | None
    queries_executed: list[str] | None
    created_at: datetime


class ReviewOut(BaseModel):
    id: UUID
    document_id: UUID
    protocol_document_id: UUID | None
    ruleset_id: str
    ruleset_version: str
    status: str
    rule_count: int
    findings: list[FindingOut]
    created_at: datetime


async def _require_ready_document(
    session: AsyncSession, document_id: UUID, role: str
) -> Document:
    document = await session.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail=f"{role} document not found")
    if document.status != "ready":
        raise HTTPException(
            status_code=409,
            detail=f"{role} document is '{document.status}', not ready — "
            "ingest it (and wait for chunking) before starting a review",
        )
    return document


@router.post("", response_model=ReviewOut, status_code=202)
async def create_review(
    body: ReviewCreate,
    background: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
):
    await _require_ready_document(session, body.document_id, "target")
    await _require_ready_document(session, body.protocol_document_id, "protocol")
    try:
        ruleset = load_ruleset(body.ruleset_id)
    except RulesetError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    review = Review(
        document_id=body.document_id,
        protocol_document_id=body.protocol_document_id,
        ruleset_id=ruleset.id,
        ruleset_version=ruleset.version,
        status="pending",
    )
    session.add(review)
    await session.commit()

    background.add_task(run_review, review.id)
    return await _to_out(session, review)


class ReviewSummary(BaseModel):
    id: UUID
    document_id: UUID
    document_filename: str | None
    ruleset_id: str
    status: str
    created_at: datetime


@router.get("", response_model=list[ReviewSummary])
async def list_reviews(session: AsyncSession = Depends(get_session)):
    rows = await session.execute(
        select(Review, Document.filename)
        .join(Document, Document.id == Review.document_id)
        .order_by(Review.created_at.desc())
    )
    return [
        ReviewSummary(
            id=review.id,
            document_id=review.document_id,
            document_filename=filename,
            ruleset_id=review.ruleset_id,
            status=review.status,
            created_at=review.created_at,
        )
        for review, filename in rows
    ]


@router.get("/{review_id}", response_model=ReviewOut)
async def get_review(review_id: UUID, session: AsyncSession = Depends(get_session)):
    review = await session.get(Review, review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found")
    return await _to_out(session, review)


async def _to_out(session: AsyncSession, review: Review) -> ReviewOut:
    try:
        ruleset = load_ruleset(review.ruleset_id)
        rules = {r.id: r for r in ruleset.rules}
    except RulesetError:
        rules = {}

    rows = (
        await session.scalars(
            select(Finding)
            .where(Finding.review_id == review.id)
            .order_by(Finding.created_at)
        )
    ).all()

    findings = [
        FindingOut(
            id=f.id,
            rule_id=f.rule_id,
            rule_title=rules[f.rule_id].title if f.rule_id in rules else None,
            citation=rules[f.rule_id].citation if f.rule_id in rules else None,
            severity=rules[f.rule_id].severity.value if f.rule_id in rules else None,
            status=f.status,
            reasoning=f.reasoning,
            verbatim_quote=f.verbatim_quote,
            span=(
                SpanOut(page=f.page, char_start=f.char_start, char_end=f.char_end)
                if f.char_start is not None
                else None
            ),
            evidence_strength=f.evidence_strength,
            protocol_reference=f.protocol_reference,
            queries_executed=f.queries_executed,
            created_at=f.created_at,
        )
        for f in rows
    ]
    return ReviewOut(
        id=review.id,
        document_id=review.document_id,
        protocol_document_id=review.protocol_document_id,
        ruleset_id=review.ruleset_id,
        ruleset_version=review.ruleset_version,
        status=review.status,
        rule_count=len(rules),
        findings=findings,
        created_at=review.created_at,
    )
