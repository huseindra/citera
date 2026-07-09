"""Review orchestrator: per rule → retrieve → evaluate → ground → persist.

Rules are isolated (one failure never aborts the review) and committed
one by one so polling clients see progress. Every step writes to the
append-only audit log; every persisted finding first passes the
citera_schemas.Finding validators (Evidence First enforced at runtime).
"""

import logging
from uuid import UUID, uuid4

from citera_pipeline.findings import derive_strength, ground_quote
from citera_pipeline.findings.base import Evaluator
from citera_rulesets import load_ruleset
from citera_schemas import AuditStep, EvidenceSpan
from citera_schemas import Finding as FindingSchema
from citera_schemas import FindingStatus, RetrievalResult, Rule
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import session_factory
from app.models import AuditRecord, Document, Finding, Review
from app.services.llm import get_evaluator
from app.services.retrieval import hybrid_search

logger = logging.getLogger(__name__)

_EVIDENCE_BACKED = {
    FindingStatus.SATISFIED,
    FindingStatus.PARTIAL,
    FindingStatus.CONFLICTING,
}


async def run_review(review_id: UUID) -> None:
    async with session_factory() as session:
        review = await session.get(Review, review_id)
        if review is None:
            logger.error("review %s vanished", review_id)
            return
        document = await session.get(Document, review.document_id)
        protocol = (
            await session.get(Document, review.protocol_document_id)
            if review.protocol_document_id
            else None
        )
        try:
            ruleset = load_ruleset(review.ruleset_id)
        except Exception as exc:
            review.status = "failed"
            await session.commit()
            logger.exception("ruleset load failed for review %s: %s", review_id, exc)
            return

        review.status = "running"
        await session.commit()

        # Capture primitives up front: session.rollback() expires ORM
        # objects, and touching an expired attribute in async SQLAlchemy
        # raises — nothing below the loop may depend on live ORM state.
        document_id = document.id
        canonical_text = document.canonical_text
        protocol_text = protocol.canonical_text if protocol else None
        include_revision = review.generate_suggested_revision

        # Pre-warm the (cached) query embeddings in ONE batched call —
        # per-rule retrieval then hits the cache instead of a rate-limited
        # API eight separate times.
        try:
            from app.services.embeddings import get_embedder

            all_queries = [q for rule in ruleset.rules for q in rule.retrieval_queries]
            await get_embedder().embed(all_queries, input_type="query")
        except Exception:
            logger.warning(
                "query prewarm failed for review %s; falling back to per-rule "
                "embedding",
                review_id,
            )

        evaluator = get_evaluator()
        try:
            for rule in ruleset.rules:
                try:
                    finding = await _evaluate_rule(
                        session,
                        review_id,
                        document_id,
                        canonical_text,
                        protocol_text,
                        rule,
                        evaluator,
                        include_revision,
                    )
                except Exception as exc:
                    logger.exception(
                        "rule %s failed in review %s", rule.id, review_id
                    )
                    # the exception may have poisoned the session (failed
                    # flush) — roll back so the failed finding can commit
                    await session.rollback()
                    finding = _failed_finding(
                        review_id, rule, f"{type(exc).__name__}: {exc}"
                    )
                try:
                    session.add(finding)
                    await session.flush()
                    session.add(
                        AuditRecord(
                            step=AuditStep.FINDING_PERSISTED,
                            review_id=review_id,
                            finding_id=finding.id,
                            document_id=document_id,
                            payload={"rule_id": rule.id, "status": finding.status},
                        )
                    )
                    await session.commit()  # progressive results for polling
                except Exception:
                    logger.exception(
                        "persisting finding for rule %s failed in review %s",
                        rule.id,
                        review_id,
                    )
                    await session.rollback()

            closing = await session.get(Review, review_id)
            if closing is not None:
                closing.status = "complete"
                await session.commit()
        except Exception:
            # LAST-RESORT safety net: a review must never stay 'running'
            # forever — polling clients would wait for eternity.
            logger.exception("review %s aborted", review_id)
            await session.rollback()
            survivor = await session.get(Review, review_id)
            if survivor is not None:
                survivor.status = "failed"
                await session.commit()


async def _evaluate_rule(
    session: AsyncSession,
    review_id: UUID,
    document_id: UUID,
    canonical_text: str,
    protocol_text: str | None,
    rule: Rule,
    evaluator: Evaluator,
    include_revision: bool,
) -> Finding:
    retrieval = await hybrid_search(
        session, document_id, rule.retrieval_queries, review_id=review_id
    )

    outcome = await evaluator.evaluate(
        rule,
        retrieval.results,
        protocol_text,
        include_suggested_revision=include_revision,
    )
    session.add(
        AuditRecord(
            step=AuditStep.EVALUATE_PROMPT,
            review_id=review_id,
            document_id=document_id,
            payload={
                "rule_id": rule.id,
                "model": outcome.model,
                "prompt": outcome.prompt_payload,
            },
        )
    )
    session.add(
        AuditRecord(
            step=AuditStep.EVALUATE_RESPONSE,
            review_id=review_id,
            document_id=document_id,
            payload={
                "rule_id": rule.id,
                "model": outcome.model,
                "response": outcome.raw_response,
            },
        )
    )

    if outcome.status == FindingStatus.NOT_FOUND:
        # Evidence of absence: the queries executed ARE the evidence.
        return _to_model(
            _validated(
                review_id=review_id,
                rule_id=rule.id,
                status=FindingStatus.NOT_FOUND,
                reasoning=outcome.reasoning,
                queries_executed=retrieval.queries_executed,
                suggested_revision=outcome.suggested_revision,
            ),
            retrieval_audit_id=retrieval.audit_record_id,
        )

    # Span-grounding gate for every evidence-backed status
    hint, source_rank = _source_chunk_hint(outcome.source_chunk_id, retrieval)
    grounding = ground_quote(outcome.verbatim_quote, canonical_text, hint)

    if not grounding.ok:
        session.add(
            AuditRecord(
                step=AuditStep.GROUNDING_FAILED,
                review_id=review_id,
                document_id=document_id,
                payload={
                    "rule_id": rule.id,
                    "claimed_status": outcome.status,
                    "quote": outcome.verbatim_quote,
                    "reason": grounding.reason,
                },
            )
        )
        return _failed_finding(
            review_id,
            rule,
            f"Rejected by the span-grounding gate ({grounding.reason}). "
            f"The evaluator claimed '{outcome.status}' with a quote that could "
            f"not be located in the document. Original reasoning: {outcome.reasoning}",
            retrieval_audit_id=retrieval.audit_record_id,
        )

    session.add(
        AuditRecord(
            step=AuditStep.GROUNDING_PASSED,
            review_id=review_id,
            document_id=document_id,
            payload={
                "rule_id": rule.id,
                "method": grounding.method,
                "char_start": grounding.char_start,
                "char_end": grounding.char_end,
            },
        )
    )

    grounded_quote = canonical_text[grounding.char_start : grounding.char_end]
    return _to_model(
        _validated(
            review_id=review_id,
            rule_id=rule.id,
            status=FindingStatus(outcome.status),
            reasoning=outcome.reasoning,
            verbatim_quote=grounded_quote,
            span=EvidenceSpan(
                document_id=document_id,
                page=None,
                char_start=grounding.char_start,
                char_end=grounding.char_end,
            ),
            evidence_strength=derive_strength(source_rank, grounding.method),
            protocol_reference=outcome.protocol_reference,
            suggested_revision=(
                outcome.suggested_revision
                if outcome.status != FindingStatus.SATISFIED
                else None
            ),
        ),
        retrieval_audit_id=retrieval.audit_record_id,
    )


def _source_chunk_hint(
    source_chunk_id: str | None, retrieval: RetrievalResult
) -> tuple[int | None, int | None]:
    if source_chunk_id:
        for chunk in retrieval.results:
            if str(chunk.chunk_id) == source_chunk_id:
                return chunk.span.char_start, chunk.rank
    return None, None


def _validated(**kwargs) -> FindingSchema:
    """Runtime enforcement of the Evidence First contract from M0."""
    return FindingSchema(id=uuid4(), **kwargs)


def _to_model(
    finding: FindingSchema, retrieval_audit_id: UUID | None = None
) -> Finding:
    return Finding(
        id=finding.id,
        review_id=finding.review_id,
        rule_id=finding.rule_id,
        status=finding.status.value,
        reasoning=finding.reasoning,
        verbatim_quote=finding.verbatim_quote,
        page=finding.span.page if finding.span else None,
        char_start=finding.span.char_start if finding.span else None,
        char_end=finding.span.char_end if finding.span else None,
        evidence_strength=(
            finding.evidence_strength.value if finding.evidence_strength else None
        ),
        protocol_reference=finding.protocol_reference,
        queries_executed=finding.queries_executed or None,
        suggested_revision=finding.suggested_revision,
        retrieval_audit_id=retrieval_audit_id,
    )


def _failed_finding(
    review_id: UUID,
    rule: Rule,
    reasoning: str,
    retrieval_audit_id: UUID | None = None,
) -> Finding:
    return _to_model(
        _validated(
            review_id=review_id,
            rule_id=rule.id,
            status=FindingStatus.EVALUATION_FAILED,
            reasoning=reasoning,
        ),
        retrieval_audit_id=retrieval_audit_id,
    )
