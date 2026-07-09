from datetime import datetime
from uuid import UUID

from citera_rulesets import RulesetError, load_ruleset
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.serializers import UTCDateTime, as_utc
from app.models import AuditRecord, Chunk, Document, Finding, Review
from app.services.coverage import COVERAGE_LABEL, IMPACT_LABEL, compute_coverage
from app.services.review import run_review

router = APIRouter(prefix="/reviews", tags=["reviews"])


class ReviewCreate(BaseModel):
    document_id: UUID
    protocol_document_id: UUID
    # accepts a pack id ("fda-21cfr50") or its short alias ("fda");
    # `ruleset` is the canonical SDK spelling, `ruleset_id` is honored
    # for backward compatibility
    ruleset: str | None = None
    ruleset_id: str = "fda-21cfr50"
    # draft an AI revision for every non-satisfied finding (labeled draft)
    generate_suggested_revision: bool = True


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
    suggested_revision: str | None
    created_at: UTCDateTime


class ReviewOut(BaseModel):
    id: UUID
    document_id: UUID
    protocol_document_id: UUID | None
    ruleset_id: str
    ruleset_version: str
    status: str
    rule_count: int
    generate_suggested_revision: bool
    # which model actually evaluated (from the audit log) — honest chip
    evaluator_model: str | None
    findings: list[FindingOut]
    created_at: UTCDateTime


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
    # ruleset first: configuration errors should fail before upload checks
    from citera_rulesets import registry, resolve_ruleset_id

    ruleset_id = resolve_ruleset_id(body.ruleset or body.ruleset_id)
    # a pack may exist (shipped, versioned) without being runnable yet —
    # the registry status is the gate, never the pack's loadability
    entry = next((e for e in registry() if e["id"] == ruleset_id), None)
    if entry and entry["status"] != "available":
        raise HTTPException(
            status_code=422,
            detail=f"Ruleset '{entry['authority']}' ({entry['jurisdiction']}) "
            f"is {entry['status'].replace('_', ' ')} — reviews cannot run "
            "against it yet.",
        )
    try:
        ruleset = load_ruleset(ruleset_id)
    except RulesetError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    await _require_ready_document(session, body.document_id, "target")
    await _require_ready_document(session, body.protocol_document_id, "protocol")

    review = Review(
        document_id=body.document_id,
        protocol_document_id=body.protocol_document_id,
        ruleset_id=ruleset.id,
        ruleset_version=ruleset.version,
        status="pending",
        generate_suggested_revision=body.generate_suggested_revision,
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
    # finding counts keyed by status — review list shows outcomes at a glance
    status_counts: dict[str, int]
    created_at: UTCDateTime


@router.get("", response_model=list[ReviewSummary])
async def list_reviews(session: AsyncSession = Depends(get_session)):
    rows = await session.execute(
        select(Review, Document.filename)
        .join(Document, Document.id == Review.document_id)
        .order_by(Review.created_at.desc())
    )
    counts_rows = await session.execute(
        select(Finding.review_id, Finding.status, func.count()).group_by(
            Finding.review_id, Finding.status
        )
    )
    counts: dict[UUID, dict[str, int]] = {}
    for review_id, status, count in counts_rows:
        counts.setdefault(review_id, {})[status] = count

    return [
        ReviewSummary(
            id=review.id,
            document_id=review.document_id,
            document_filename=filename,
            ruleset_id=review.ruleset_id,
            status=review.status,
            status_counts=counts.get(review.id, {}),
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


class CoverageRowOut(BaseModel):
    rule_id: str
    rule_title: str
    citation: str
    severity: str
    impact: str
    status: str | None
    label: str
    percent: int


class CoverageOut(BaseModel):
    percent: int
    passed: int
    total: int
    verdict: str
    rows: list[CoverageRowOut]


class ReviewReportOut(BaseModel):
    review: ReviewOut
    document_filename: str | None
    coverage: CoverageOut


async def _report_payload(
    session: AsyncSession, review: Review
) -> ReviewReportOut:
    out = await _to_out(session, review)
    try:
        rules = load_ruleset(review.ruleset_id).rules
    except RulesetError:
        rules = []
    findings = (
        await session.scalars(select(Finding).where(Finding.review_id == review.id))
    ).all()
    summary = compute_coverage(rules, findings)
    document = await session.get(Document, review.document_id)
    return ReviewReportOut(
        review=out,
        document_filename=document.filename if document else None,
        coverage=CoverageOut(
            percent=summary.percent,
            passed=summary.passed,
            total=summary.total,
            verdict=summary.verdict,
            rows=[CoverageRowOut(**vars(row)) for row in summary.rows],
        ),
    )


def _render_markdown(report: ReviewReportOut) -> str:
    """Reviewer-facing report: findings with verified quotes and drafted
    revisions — never embeddings, retrieval scores, or prompts."""
    review = report.review
    coverage = report.coverage
    lines = [
        f"# Compliance Review Report — {report.document_filename or review.document_id}",
        "",
        f"- **Ruleset:** {review.ruleset_id} (v{review.ruleset_version})",
        f"- **Review ID:** `{review.id}`",
        f"- **Reviewed at:** {as_utc(review.created_at).isoformat()}",
        "",
        "## Regulatory Readiness",
        "",
        f"**{coverage.verdict}** — {coverage.percent}% evidence coverage, "
        f"{coverage.passed} / {coverage.total} requirements passed.",
        "",
        "| Requirement | Citation | Impact | Status |",
        "|---|---|---|---|",
    ]
    for row in coverage.rows:
        lines.append(
            f"| {row.rule_title} | {row.citation} | {row.impact} | {row.label} |"
        )

    issues = [f for f in review.findings if f.status != "satisfied"]
    lines += ["", "## Findings", ""]
    if not issues:
        lines.append("Every requirement is satisfied with verified evidence.")
    for finding in issues:
        label = COVERAGE_LABEL.get(finding.status, finding.status)
        lines += [
            f"### {finding.rule_title or finding.rule_id} — {label}",
            "",
            f"- **Citation:** {finding.citation or '—'}",
            f"- **Impact:** {IMPACT_LABEL.get(finding.severity or '', finding.severity or '—')}",
            "",
            f"{finding.reasoning}",
            "",
        ]
        if finding.verbatim_quote:
            lines += [
                "**Verified evidence (span-checked against the source):**",
                "",
                f"> {finding.verbatim_quote}",
                "",
            ]
        if finding.protocol_reference:
            lines += [f"**Protocol reference:** {finding.protocol_reference}", ""]
        if finding.suggested_revision:
            lines += [
                "**Suggested revision (AI draft — reviewer sign-off required):**",
                "",
                f"> {finding.suggested_revision}",
                "",
            ]
    lines += [
        "---",
        "",
        "_Generated by Citera — Clinical Regulatory Intelligence. Every quote "
        "is span-verified against the source document; unverifiable claims "
        "are rejected, not reported._",
    ]
    return "\n".join(lines)


@router.get("/{review_id}/report")
async def export_report(
    review_id: UUID,
    format: str = "json",
    session: AsyncSession = Depends(get_session),
):
    """Export a completed review as a structured report. The canonical
    export surface — the SDK and MCP `export_report` both call this."""
    if format not in ("json", "markdown"):
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported format '{format}' — use 'json' or 'markdown'. "
            "For PDF, open the printable report in the Playground.",
        )
    review = await session.get(Review, review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.status != "complete":
        raise HTTPException(
            status_code=409,
            detail=f"Review is '{review.status}' — reports are available "
            "once the review is complete.",
        )
    report = await _report_payload(session, review)
    if format == "markdown":
        return PlainTextResponse(
            _render_markdown(report), media_type="text/markdown; charset=utf-8"
        )
    return report


class EvidenceChunkOut(BaseModel):
    chunk_id: UUID
    rank: int
    section_title: str | None
    char_start: int | None
    char_end: int | None
    text_preview: str | None
    dense_score: float | None
    sparse_score: float | None
    fused_score: float


class FindingEvidenceOut(BaseModel):
    finding_id: UUID
    queries_executed: list[str]
    fusion_params: dict
    embedding_model: str | None
    results: list[EvidenceChunkOut]


@router.get(
    "/{review_id}/findings/{finding_id}/evidence",
    response_model=FindingEvidenceOut,
)
async def get_finding_evidence(
    review_id: UUID, finding_id: UUID, session: AsyncSession = Depends(get_session)
):
    """The audit layer of the finding drawer: the retrieval that fed this
    finding, served verbatim from the audit record (record-and-show) and
    joined with chunk metadata for display context only."""
    finding = await session.get(Finding, finding_id)
    if finding is None or finding.review_id != review_id:
        raise HTTPException(status_code=404, detail="Finding not found")
    if finding.retrieval_audit_id is None:
        raise HTTPException(
            status_code=404, detail="No retrieval recorded for this finding"
        )
    audit = await session.get(AuditRecord, finding.retrieval_audit_id)
    if audit is None:
        raise HTTPException(status_code=404, detail="Audit record not found")

    payload = audit.payload
    recorded = payload.get("results", [])
    chunk_ids = [UUID(r["chunk_id"]) for r in recorded]
    rows = {}
    if chunk_ids:
        found = await session.scalars(select(Chunk).where(Chunk.id.in_(chunk_ids)))
        rows = {c.id: c for c in found}

    results = []
    for r in recorded:
        chunk = rows.get(UUID(r["chunk_id"]))
        results.append(
            EvidenceChunkOut(
                chunk_id=UUID(r["chunk_id"]),
                rank=r["rank"],
                dense_score=r["dense_score"],
                sparse_score=r["sparse_score"],
                fused_score=r["fused_score"],
                section_title=chunk.section_title if chunk else None,
                char_start=chunk.char_start if chunk else None,
                char_end=chunk.char_end if chunk else None,
                text_preview=(chunk.text[:180] if chunk else None),
            )
        )
    return FindingEvidenceOut(
        finding_id=finding.id,
        queries_executed=payload.get("queries", []),
        fusion_params=payload.get("fusion_params", {}),
        embedding_model=payload.get("embedding_model"),
        results=results,
    )


class AuditRecordOut(BaseModel):
    id: UUID
    step: str
    created_at: UTCDateTime
    # served verbatim from the append-only log — never summarized
    payload: dict


class FindingAuditOut(BaseModel):
    finding_id: UUID
    rule_id: str
    records: list[AuditRecordOut]


# created_at is Postgres' transaction timestamp, so records written in one
# per-rule transaction tie — pipeline order breaks the tie deterministically.
_STEP_ORDER = {
    "ingest.extract": 0,
    "ingest.chunk": 1,
    "ingest.embed": 2,
    "retrieve": 3,
    "evaluate.prompt": 4,
    "evaluate.response": 5,
    "grounding.passed": 6,
    "grounding.failed": 6,
    "finding.persisted": 7,
}


@router.get(
    "/{review_id}/findings/{finding_id}/audit", response_model=FindingAuditOut
)
async def get_finding_audit(
    review_id: UUID, finding_id: UUID, session: AsyncSession = Depends(get_session)
):
    """Everything that produced this finding, in order, from the
    append-only audit log. Record-and-show: this endpoint selects and
    orders; it never re-executes or rewrites payloads."""
    review = await session.get(Review, review_id)
    finding = await session.get(Finding, finding_id)
    if review is None or finding is None or finding.review_id != review_id:
        raise HTTPException(status_code=404, detail="Finding not found")

    conditions = [
        # the reviewed document's ingestion trail
        and_(
            AuditRecord.document_id == review.document_id,
            AuditRecord.step.like("ingest.%"),
        ),
        # this rule's evaluation + grounding records
        and_(
            AuditRecord.review_id == review_id,
            AuditRecord.payload["rule_id"].astext == finding.rule_id,
        ),
        # the persisted-finding record
        AuditRecord.finding_id == finding_id,
    ]
    if finding.retrieval_audit_id is not None:
        conditions.append(AuditRecord.id == finding.retrieval_audit_id)

    rows = (await session.scalars(select(AuditRecord).where(or_(*conditions)))).all()
    rows.sort(key=lambda r: (r.created_at, _STEP_ORDER.get(r.step, 99)))

    return FindingAuditOut(
        finding_id=finding.id,
        rule_id=finding.rule_id,
        records=[
            AuditRecordOut(
                id=r.id, step=r.step, created_at=r.created_at, payload=r.payload
            )
            for r in rows
        ],
    )


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

    evaluator_model = await session.scalar(
        select(AuditRecord.payload["model"].astext)
        .where(
            AuditRecord.review_id == review.id,
            AuditRecord.step == "evaluate.prompt",
        )
        .limit(1)
    )

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
            suggested_revision=f.suggested_revision,
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
        generate_suggested_revision=review.generate_suggested_revision,
        evaluator_model=evaluator_model,
        findings=findings,
        created_at=review.created_at,
    )
