from dataclasses import dataclass, field
from typing import Any, Protocol

from citera_schemas import RetrievedChunk, Rule

# Statuses the evaluator may claim. evaluation_failed is never an LLM
# output — only the pipeline assigns it (grounding rejection, errors).
CLAIMABLE_STATUSES = {"satisfied", "partial", "not_found", "conflicting"}


class EvaluationError(Exception):
    pass


@dataclass
class EvaluationOutcome:
    status: str
    reasoning: str
    verbatim_quote: str | None
    source_chunk_id: str | None
    protocol_reference: str | None
    model: str
    # raw truth for the audit log — recorded verbatim, never summarized
    prompt_payload: dict[str, Any] = field(default_factory=dict)
    raw_response: dict[str, Any] = field(default_factory=dict)


class Evaluator(Protocol):
    model: str

    async def evaluate(
        self,
        rule: Rule,
        evidence: list[RetrievedChunk],
        protocol_text: str | None,
    ) -> EvaluationOutcome: ...
