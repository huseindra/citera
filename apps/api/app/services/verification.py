"""The Verify Loop core: judge ONE proposed revision against ONE
requirement, using the exact evaluation + grounding path the rule packs
were validated on (spike-confirmed live before this was built).

Claude proposes; this module verifies. The original review is immutable —
every attempt is an append-only `verify.revision` audit record, and a
finding is only ever *overlaid* as resolved, never rewritten.
"""

import hashlib
from dataclasses import dataclass
from uuid import UUID, uuid4

from citera_pipeline.findings import ground_quote
from citera_rulesets import load_ruleset
from citera_schemas import AuditStep, EvidenceSpan, FindingStatus, RetrievedChunk
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditRecord, Document, Finding, Review
from app.services.llm import get_evaluator


@dataclass
class VerificationResult:
    verdict: str  # "verified" | "rejected"
    status: str  # engine status behind the verdict
    reasoning: str
    verified_quote: str | None
    quote_char_start: int | None  # offsets into the submitted revision
    quote_char_end: int | None
    evaluator_model: str
    attempt: int
    audit_id: UUID


class VerificationError(Exception):
    pass


async def verify_revision(
    session: AsyncSession,
    finding: Finding,
    review: Review,
    revised_text: str,
) -> VerificationResult:
    ruleset = load_ruleset(review.ruleset_id)
    rule = next((r for r in ruleset.rules if r.id == finding.rule_id), None)
    if rule is None:
        raise VerificationError(
            f"Rule '{finding.rule_id}' not found in {review.ruleset_id}"
        )

    protocol_text = None
    if review.protocol_document_id is not None:
        protocol = await session.get(Document, review.protocol_document_id)
        protocol_text = protocol.canonical_text if protocol else None

    # The candidate revision IS the evidence under judgment — one
    # pseudo-chunk, same evaluator, same protocol context as a review.
    chunk = RetrievedChunk(
        chunk_id=uuid4(),
        text=revised_text,
        span=EvidenceSpan(
            document_id=review.document_id,
            char_start=0,
            char_end=len(revised_text),
        ),
        section_title="Proposed revision",
        fused_score=1.0,
        rank=1,
    )
    outcome = await get_evaluator().evaluate(rule, [chunk], protocol_text)

    # Span-grounding gate, unchanged: a verified verdict may only carry a
    # quote that round-trips byte-for-byte against the submitted revision.
    quote: str | None = None
    char_start: int | None = None
    char_end: int | None = None
    status = outcome.status.value if isinstance(outcome.status, FindingStatus) else str(outcome.status)
    reasoning = outcome.reasoning or ""
    if status != FindingStatus.NOT_FOUND.value and outcome.verbatim_quote:
        grounding = ground_quote(outcome.verbatim_quote, revised_text, None)
        if grounding.ok:
            # store the exact slice, same as the review engine — the span
            # must reproduce the quote byte-for-byte
            char_start, char_end = grounding.char_start, grounding.char_end
            quote = revised_text[char_start:char_end]
        else:
            # rejection over hallucination — an ungroundable quote can
            # never support a verified verdict
            status = FindingStatus.EVALUATION_FAILED.value
            reasoning = (
                "The evaluator's evidence quote failed span verification "
                f"against the submitted revision ({grounding.reason}); the "
                "revision cannot be verified. Resubmit to retry."
            )

    verdict = "verified" if status == FindingStatus.SATISFIED.value else "rejected"

    prior_attempts = await session.scalar(
        select(func.count())
        .select_from(AuditRecord)
        .where(
            AuditRecord.finding_id == finding.id,
            AuditRecord.step == AuditStep.VERIFY_REVISION,
        )
    )
    attempt = int(prior_attempts or 0) + 1

    audit = AuditRecord(
        step=AuditStep.VERIFY_REVISION,
        review_id=review.id,
        finding_id=finding.id,
        document_id=review.document_id,
        payload={
            "rule_id": finding.rule_id,
            "attempt": attempt,
            "verdict": verdict,
            "status": status,
            "reasoning": reasoning,
            "revised_sha256": hashlib.sha256(revised_text.encode()).hexdigest(),
            "revised_chars": len(revised_text),
            "quote": quote,
            "quote_span": (
                {"char_start": char_start, "char_end": char_end}
                if char_start is not None
                else None
            ),
            "model": outcome.model,
        },
    )
    session.add(audit)
    await session.commit()

    return VerificationResult(
        verdict=verdict,
        status=status,
        reasoning=reasoning,
        verified_quote=quote,
        quote_char_start=char_start,
        quote_char_end=char_end,
        evaluator_model=outcome.model,
        attempt=attempt,
        audit_id=audit.id,
    )


async def latest_verifications(
    session: AsyncSession, review_id: UUID
) -> dict[UUID, dict]:
    """Latest verify.revision payload per finding — the overlay input.
    Returns {finding_id: payload} using each finding's most recent attempt."""
    rows = (
        await session.execute(
            select(AuditRecord.finding_id, AuditRecord.payload, AuditRecord.created_at)
            .where(
                AuditRecord.review_id == review_id,
                AuditRecord.step == AuditStep.VERIFY_REVISION,
            )
            .order_by(AuditRecord.created_at)
        )
    ).all()
    latest: dict[UUID, dict] = {}
    for finding_id, payload, _created in rows:
        if finding_id is not None:
            latest[finding_id] = payload  # later rows overwrite: latest wins
    return latest
