"""Staged reviewer workflow over an immutable AI review.

Review 1..N are sequential human passes; each reviewer decision is a
FindingDetermination row that is appended, never updated — the history IS
the change log required for the audit trail. When every required stage is
completed the review can receive its digital stamp (ReviewApproval): the
Verified verdict, bound to a sha256 of the report payload at stamping
time. The AI findings themselves are never mutated by any of this.
"""

import hashlib
from datetime import datetime, timezone
from uuid import UUID

from citera_schemas import AuditStep
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import (
    AuditRecord,
    Document,
    Finding,
    FindingDetermination,
    Review,
    ReviewApproval,
    ReviewStage,
)
from app.serializers import UTCDateTime

router = APIRouter(prefix="/reviews/{review_id}", tags=["workflow"])

DECISIONS = ("concur", "override")


class DeterminationOut(BaseModel):
    id: UUID
    stage_id: UUID
    finding_id: UUID
    rule_id: str | None
    decision: str
    comment: str | None
    edited_text: str | None
    reviewer_name: str
    created_at: UTCDateTime


class StageOut(BaseModel):
    id: UUID
    stage_number: int
    reviewer_name: str
    status: str
    notes: str | None
    created_at: UTCDateTime
    completed_at: UTCDateTime | None
    # full history, oldest first — the latest row per finding is the
    # current determination, earlier rows are the stage's change log
    determinations: list[DeterminationOut]


class ApprovalOut(BaseModel):
    id: UUID
    reviewer_name: str
    content_hash: str
    created_at: UTCDateTime


class WorkflowOut(BaseModel):
    review_id: UUID
    review_status: str
    required_stages: int
    completed_stages: int
    stages: list[StageOut]
    approval: ApprovalOut | None


async def _require_review(session: AsyncSession, review_id: UUID) -> Review:
    review = await session.get(Review, review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found")
    return review


async def _approval_of(
    session: AsyncSession, review_id: UUID
) -> ReviewApproval | None:
    return await session.scalar(
        select(ReviewApproval).where(ReviewApproval.review_id == review_id)
    )


async def _require_open_workflow(
    session: AsyncSession, review_id: UUID
) -> Review:
    """A workflow accepts changes only between review completion and the
    Verified stamp."""
    review = await _require_review(session, review_id)
    if review.status != "complete":
        raise HTTPException(
            status_code=409,
            detail=f"Review is '{review.status}' — the reviewer workflow "
            "starts once the review is complete.",
        )
    if await _approval_of(session, review_id) is not None:
        raise HTTPException(
            status_code=409,
            detail="Review is already Verified — the workflow is closed.",
        )
    return review


async def _workflow_out(session: AsyncSession, review: Review) -> WorkflowOut:
    stages = (
        await session.scalars(
            select(ReviewStage)
            .where(ReviewStage.review_id == review.id)
            .order_by(ReviewStage.stage_number)
        )
    ).all()
    rows = (
        await session.execute(
            select(FindingDetermination, Finding.rule_id)
            .join(Finding, Finding.id == FindingDetermination.finding_id)
            .where(FindingDetermination.review_id == review.id)
            .order_by(FindingDetermination.created_at)
        )
    ).all()
    by_stage: dict[UUID, list[DeterminationOut]] = {}
    for det, rule_id in rows:
        by_stage.setdefault(det.stage_id, []).append(
            DeterminationOut(
                id=det.id,
                stage_id=det.stage_id,
                finding_id=det.finding_id,
                rule_id=rule_id,
                decision=det.decision,
                comment=det.comment,
                edited_text=det.edited_text,
                reviewer_name=det.reviewer_name,
                created_at=det.created_at,
            )
        )
    approval = await _approval_of(session, review.id)
    return WorkflowOut(
        review_id=review.id,
        review_status=review.status,
        required_stages=review.required_stages,
        completed_stages=sum(1 for s in stages if s.status == "completed"),
        stages=[
            StageOut(
                id=s.id,
                stage_number=s.stage_number,
                reviewer_name=s.reviewer_name,
                status=s.status,
                notes=s.notes,
                created_at=s.created_at,
                completed_at=s.completed_at,
                determinations=by_stage.get(s.id, []),
            )
            for s in stages
        ],
        approval=(
            ApprovalOut(
                id=approval.id,
                reviewer_name=approval.reviewer_name,
                content_hash=approval.content_hash,
                created_at=approval.created_at,
            )
            if approval
            else None
        ),
    )


@router.get("/workflow", response_model=WorkflowOut)
async def get_workflow(
    review_id: UUID, session: AsyncSession = Depends(get_session)
):
    review = await _require_review(session, review_id)
    return await _workflow_out(session, review)


class StageCreate(BaseModel):
    reviewer_name: str = Field(min_length=1, max_length=200)


@router.post("/stages", response_model=WorkflowOut, status_code=201)
async def start_stage(
    review_id: UUID,
    body: StageCreate,
    session: AsyncSession = Depends(get_session),
):
    review = await _require_open_workflow(session, review_id)
    stages = (
        await session.scalars(
            select(ReviewStage)
            .where(ReviewStage.review_id == review_id)
            .order_by(ReviewStage.stage_number)
        )
    ).all()
    if stages and stages[-1].status != "completed":
        raise HTTPException(
            status_code=409,
            detail=f"Review {stages[-1].stage_number} is still in progress — "
            "complete it before starting the next stage.",
        )
    stage = ReviewStage(
        review_id=review_id,
        stage_number=len(stages) + 1,
        reviewer_name=body.reviewer_name.strip(),
    )
    session.add(stage)
    await session.flush()
    session.add(
        AuditRecord(
            step=AuditStep.WORKFLOW_STAGE_STARTED,
            review_id=review_id,
            document_id=review.document_id,
            payload={
                "stage_id": str(stage.id),
                "stage_number": stage.stage_number,
                "reviewer_name": stage.reviewer_name,
            },
        )
    )
    await session.commit()
    return await _workflow_out(session, review)


async def _require_open_stage(
    session: AsyncSession, review_id: UUID, stage_id: UUID
) -> ReviewStage:
    stage = await session.get(ReviewStage, stage_id)
    if stage is None or stage.review_id != review_id:
        raise HTTPException(status_code=404, detail="Stage not found")
    if stage.status != "in_progress":
        raise HTTPException(
            status_code=409,
            detail=f"Review {stage.stage_number} is completed — its "
            "determinations are part of the audit trail and cannot change.",
        )
    return stage


class DeterminationCreate(BaseModel):
    finding_id: UUID
    decision: str
    comment: str | None = None
    edited_text: str | None = None


@router.post(
    "/stages/{stage_id}/determinations",
    response_model=WorkflowOut,
    status_code=201,
)
async def add_determination(
    review_id: UUID,
    stage_id: UUID,
    body: DeterminationCreate,
    session: AsyncSession = Depends(get_session),
):
    """Append the reviewer's decision on one finding. Re-submitting for the
    same finding appends a new row — the latest wins, the history stays."""
    review = await _require_open_workflow(session, review_id)
    stage = await _require_open_stage(session, review_id, stage_id)

    if body.decision not in DECISIONS:
        raise HTTPException(
            status_code=422,
            detail=f"decision must be one of {', '.join(DECISIONS)}",
        )
    if body.decision == "override" and not (
        (body.comment or "").strip() or (body.edited_text or "").strip()
    ):
        raise HTTPException(
            status_code=422,
            detail="An override must say what changes: provide a comment "
            "and/or edited_text.",
        )
    finding = await session.get(Finding, body.finding_id)
    if finding is None or finding.review_id != review_id:
        raise HTTPException(status_code=404, detail="Finding not found")

    determination = FindingDetermination(
        stage_id=stage.id,
        review_id=review_id,
        finding_id=finding.id,
        decision=body.decision,
        comment=body.comment,
        edited_text=body.edited_text,
        reviewer_name=stage.reviewer_name,
    )
    session.add(determination)
    await session.flush()
    session.add(
        AuditRecord(
            step=AuditStep.WORKFLOW_DETERMINATION,
            review_id=review_id,
            finding_id=finding.id,
            document_id=review.document_id,
            payload={
                "stage_id": str(stage.id),
                "stage_number": stage.stage_number,
                "determination_id": str(determination.id),
                "rule_id": finding.rule_id,
                "decision": body.decision,
                "comment": body.comment,
                "edited_text": body.edited_text,
                "reviewer_name": stage.reviewer_name,
            },
        )
    )
    await session.commit()
    return await _workflow_out(session, review)


class ManualFindingCreate(BaseModel):
    rule_id: str
    status: str  # satisfied | partial | conflicting | not_found
    reasoning: str = Field(min_length=1)
    verbatim_quote: str | None = None


class ManualFindingOut(BaseModel):
    finding_id: UUID
    rule_id: str
    status: str
    source: str
    reviewer_name: str
    char_start: int | None
    char_end: int | None


_MANUAL_STATUSES = ("satisfied", "partial", "conflicting", "not_found")


@router.post(
    "/stages/{stage_id}/findings",
    response_model=ManualFindingOut,
    status_code=201,
)
async def add_manual_finding(
    review_id: UUID,
    stage_id: UUID,
    body: ManualFindingCreate,
    session: AsyncSession = Depends(get_session),
):
    """A reviewer-authored finding the engine missed — a NEW row
    (source='reviewer'), never a mutation of an AI finding. Evidence
    First still applies: a quote must ground byte-for-byte against the
    reviewed document or the finding is rejected."""
    from citera_pipeline.findings import ground_quote
    from citera_rulesets import RulesetError, load_ruleset

    review = await _require_open_workflow(session, review_id)
    stage = await _require_open_stage(session, review_id, stage_id)

    if body.status not in _MANUAL_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"status must be one of {', '.join(_MANUAL_STATUSES)}",
        )
    try:
        rules = {r.id for r in load_ruleset(review.ruleset_id).rules}
    except RulesetError:
        rules = set()
    if body.rule_id not in rules:
        raise HTTPException(
            status_code=422,
            detail=f"Rule '{body.rule_id}' is not part of {review.ruleset_id}",
        )

    char_start: int | None = None
    char_end: int | None = None
    quote: str | None = None
    if body.verbatim_quote and body.verbatim_quote.strip():
        document = await session.get(Document, review.document_id)
        grounding = ground_quote(
            body.verbatim_quote, document.canonical_text, None
        )
        if not grounding.ok:
            raise HTTPException(
                status_code=422,
                detail="The quote could not be located in the reviewed "
                f"document ({grounding.reason}) — findings only carry "
                "evidence that grounds verbatim.",
            )
        char_start, char_end = grounding.char_start, grounding.char_end
        quote = document.canonical_text[char_start:char_end]

    finding = Finding(
        review_id=review_id,
        rule_id=body.rule_id,
        status=body.status,
        reasoning=body.reasoning,
        verbatim_quote=quote,
        char_start=char_start,
        char_end=char_end,
        source="reviewer",
        reviewer_name=stage.reviewer_name,
    )
    session.add(finding)
    await session.flush()
    session.add(
        AuditRecord(
            step=AuditStep.WORKFLOW_FINDING_ADDED,
            review_id=review_id,
            finding_id=finding.id,
            document_id=review.document_id,
            payload={
                "stage_id": str(stage.id),
                "stage_number": stage.stage_number,
                "reviewer_name": stage.reviewer_name,
                "rule_id": body.rule_id,
                "status": body.status,
                "reasoning": body.reasoning,
                "quote": quote,
                "quote_span": (
                    {"char_start": char_start, "char_end": char_end}
                    if char_start is not None
                    else None
                ),
            },
        )
    )
    await session.commit()
    return ManualFindingOut(
        finding_id=finding.id,
        rule_id=finding.rule_id,
        status=finding.status,
        source=finding.source,
        reviewer_name=stage.reviewer_name,
        char_start=char_start,
        char_end=char_end,
    )


class StageComplete(BaseModel):
    notes: str | None = None


@router.post("/stages/{stage_id}/complete", response_model=WorkflowOut)
async def complete_stage(
    review_id: UUID,
    stage_id: UUID,
    body: StageComplete,
    session: AsyncSession = Depends(get_session),
):
    review = await _require_open_workflow(session, review_id)
    stage = await _require_open_stage(session, review_id, stage_id)

    determination_count = await session.scalar(
        select(func.count())
        .select_from(FindingDetermination)
        .where(FindingDetermination.stage_id == stage.id)
    )
    stage.status = "completed"
    # naive UTC, matching the storage convention (see serializers.py)
    stage.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    stage.notes = body.notes
    session.add(
        AuditRecord(
            step=AuditStep.WORKFLOW_STAGE_COMPLETED,
            review_id=review_id,
            document_id=review.document_id,
            payload={
                "stage_id": str(stage.id),
                "stage_number": stage.stage_number,
                "reviewer_name": stage.reviewer_name,
                "determinations": int(determination_count or 0),
                "notes": body.notes,
            },
        )
    )
    await session.commit()
    return await _workflow_out(session, review)


class ApprovalCreate(BaseModel):
    reviewer_name: str = Field(min_length=1, max_length=200)


@router.post("/approval", response_model=WorkflowOut, status_code=201)
async def approve_review(
    review_id: UUID,
    body: ApprovalCreate,
    session: AsyncSession = Depends(get_session),
):
    """The digital stamp. Only after every required stage is completed;
    binds the Verified verdict to a sha256 of the report payload so any
    later divergence is detectable."""
    review = await _require_open_workflow(session, review_id)

    completed = await session.scalar(
        select(func.count())
        .select_from(ReviewStage)
        .where(
            ReviewStage.review_id == review_id,
            ReviewStage.status == "completed",
        )
    )
    if int(completed or 0) < review.required_stages:
        raise HTTPException(
            status_code=409,
            detail=f"{completed or 0} of {review.required_stages} review "
            "stages completed — the Verified stamp requires all of them.",
        )

    # the canonical report payload is the thing being approved
    from app.routers.reviews import _report_payload

    report = await _report_payload(session, review)
    content_hash = hashlib.sha256(
        report.model_dump_json().encode()
    ).hexdigest()

    approval = ReviewApproval(
        review_id=review_id,
        reviewer_name=body.reviewer_name.strip(),
        content_hash=content_hash,
    )
    session.add(approval)
    await session.flush()
    session.add(
        AuditRecord(
            step=AuditStep.REVIEW_APPROVED,
            review_id=review_id,
            document_id=review.document_id,
            payload={
                "approval_id": str(approval.id),
                "reviewer_name": approval.reviewer_name,
                "content_hash": content_hash,
                "completed_stages": int(completed or 0),
                "required_stages": review.required_stages,
            },
        )
    )
    await session.commit()
    return await _workflow_out(session, review)
