"""Finding dossier by id — the single-argument lookup behind the SDK's
`findings.get()` and the MCP `get_finding` tool. Composes the finding,
its requirement, and its audit status; reviewer-facing fields only
(never embeddings, retrieval scores, or prompts)."""

from datetime import datetime
from uuid import UUID

from citera_rulesets import RulesetError, load_ruleset
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import AuditRecord, Finding, Review
from app.services.coverage import COVERAGE_LABEL, IMPACT_LABEL

router = APIRouter(prefix="/findings", tags=["findings"])


class RequirementOut(BaseModel):
    rule_id: str
    title: str | None
    citation: str | None
    description: str | None
    severity: str | None
    impact: str | None
    statutory_refs: list[str]
    remediation: str | None


class SpanOut(BaseModel):
    page: int | None
    char_start: int
    char_end: int


class AuditStatusOut(BaseModel):
    # a quote only reaches the reviewer after byte-for-byte span
    # verification against the source document
    span_verified: bool
    records: int


class FindingDetailOut(BaseModel):
    id: UUID
    review_id: UUID
    ruleset_id: str
    requirement: RequirementOut
    status: str
    status_label: str
    reasoning: str
    verbatim_quote: str | None
    span: SpanOut | None
    evidence_strength: str | None
    protocol_reference: str | None
    suggested_revision: str | None
    audit: AuditStatusOut
    created_at: datetime


@router.get("/{finding_id}", response_model=FindingDetailOut)
async def get_finding(
    finding_id: UUID, session: AsyncSession = Depends(get_session)
):
    finding = await session.get(Finding, finding_id)
    if finding is None:
        raise HTTPException(status_code=404, detail="Finding not found")
    review = await session.get(Review, finding.review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found")

    rule = None
    try:
        rules = {r.id: r for r in load_ruleset(review.ruleset_id).rules}
        rule = rules.get(finding.rule_id)
    except RulesetError:
        pass

    audit_records = await session.scalar(
        select(func.count())
        .select_from(AuditRecord)
        .where(
            or_(
                AuditRecord.finding_id == finding.id,
                and_(
                    AuditRecord.review_id == review.id,
                    AuditRecord.payload["rule_id"].astext == finding.rule_id,
                ),
            )
        )
    )

    return FindingDetailOut(
        id=finding.id,
        review_id=finding.review_id,
        ruleset_id=review.ruleset_id,
        requirement=RequirementOut(
            rule_id=finding.rule_id,
            title=rule.title if rule else None,
            citation=rule.citation if rule else None,
            description=rule.description if rule else None,
            severity=rule.severity.value if rule else None,
            impact=IMPACT_LABEL.get(rule.severity.value) if rule else None,
            statutory_refs=rule.statutory_refs if rule else [],
            remediation=rule.remediation if rule else None,
        ),
        status=finding.status,
        status_label=COVERAGE_LABEL.get(finding.status, finding.status),
        reasoning=finding.reasoning,
        verbatim_quote=finding.verbatim_quote,
        span=(
            SpanOut(
                page=finding.page,
                char_start=finding.char_start,
                char_end=finding.char_end,
            )
            if finding.char_start is not None
            else None
        ),
        evidence_strength=finding.evidence_strength,
        protocol_reference=finding.protocol_reference,
        suggested_revision=finding.suggested_revision,
        audit=AuditStatusOut(
            span_verified=finding.verbatim_quote is not None
            and finding.char_start is not None,
            records=audit_records or 0,
        ),
        created_at=finding.created_at,
    )
