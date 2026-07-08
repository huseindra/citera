from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, model_validator

from citera_schemas.evidence import EvidenceSpan


class FindingStatus(StrEnum):
    SATISFIED = "satisfied"
    PARTIAL = "partial"
    NOT_FOUND = "not_found"
    CONFLICTING = "conflicting"
    # Honest state: the pipeline could not evaluate this rule (LLM failure,
    # grounding rejection, …). Never rendered as satisfied.
    EVALUATION_FAILED = "evaluation_failed"


class EvidenceStrength(StrEnum):
    STRONG = "strong"
    MODERATE = "moderate"
    WEAK = "weak"


# Statuses whose claim is grounded in document text and therefore must
# carry inspectable evidence.
_EVIDENCE_BACKED = {
    FindingStatus.SATISFIED,
    FindingStatus.PARTIAL,
    FindingStatus.CONFLICTING,
}


class Finding(BaseModel):
    """An AI-generated review finding. Evidence First is enforced here:
    no evidence-backed status can exist without a verbatim quote and a span.
    """

    id: UUID
    review_id: UUID
    rule_id: str
    status: FindingStatus
    reasoning: str
    verbatim_quote: str | None = None
    span: EvidenceSpan | None = None
    evidence_strength: EvidenceStrength | None = None
    protocol_reference: str | None = None
    # For not_found: proof of what was searched (evidence of absence).
    queries_executed: list[str] = []

    @model_validator(mode="after")
    def _evidence_first(self) -> "Finding":
        if self.status in _EVIDENCE_BACKED:
            if self.span is None or not self.verbatim_quote:
                raise ValueError(
                    f"status '{self.status}' requires both span and verbatim_quote"
                )
        if self.status == FindingStatus.NOT_FOUND:
            if self.span is not None:
                raise ValueError("not_found findings must not carry a span")
            if not self.queries_executed:
                raise ValueError(
                    "not_found findings must record queries_executed "
                    "(evidence of absence)"
                )
        return self
