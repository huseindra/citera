"""Deterministic evaluator for tests and keyless development.

Quotes verbatim from the top retrieved chunk, so findings pass the
span-grounding gate against real ingested documents. Honestly labeled
'scripted-demo' in every audit record — never a stand-in for Claude in
a real review.
"""

from citera_schemas import RetrievedChunk, Rule

from citera_pipeline.findings.base import EvaluationOutcome

_CANNED_REASONING = {
    "satisfied": (
        "The quoted ICF text addresses this requirement and is consistent "
        "with the study protocol. [scripted evaluator]"
    ),
    "partial": (
        "The quoted ICF text touches this requirement but omits a required "
        "element of it. [scripted evaluator]"
    ),
    "conflicting": (
        "The quoted ICF text contradicts the study protocol's documented "
        "position on this requirement. [scripted evaluator]"
    ),
    "not_found": (
        "None of the retrieved evidence is relevant to this requirement; "
        "the element appears to be absent from the document. [scripted evaluator]"
    ),
}


class ScriptedEvaluator:
    model = "scripted-demo"

    def __init__(
        self,
        expectations: dict[str, str] | None = None,
        fabricate: frozenset[str] | set[str] = frozenset(),
    ):
        self._expectations = expectations or {}
        self._fabricate = set(fabricate)

    async def evaluate(
        self,
        rule: Rule,
        evidence: list[RetrievedChunk],
        protocol_text: str | None,
    ) -> EvaluationOutcome:
        status = self._expectations.get(rule.id, "satisfied")
        quote: str | None = None
        source_chunk_id: str | None = None
        protocol_reference: str | None = None

        if rule.id in self._fabricate:
            # deliberately ungroundable — exercises the grounding gate
            quote = "This exact sentence does not appear anywhere in the document."
            source_chunk_id = str(evidence[0].chunk_id) if evidence else None
            status = self._expectations.get(rule.id, "satisfied")
        elif status != "not_found" and evidence:
            top = evidence[0]
            quote = _verbatim_excerpt(top.text)
            source_chunk_id = str(top.chunk_id)
            if status == "conflicting":
                protocol_reference = (
                    "Protocol §6 Risks and Safety Considerations documents "
                    "elevated liver enzymes (~3%, monitored every visit) and a "
                    "serious hypersensitivity reaction (angioedema). [scripted]"
                )

        return EvaluationOutcome(
            status=status,
            reasoning=_CANNED_REASONING[status],
            verbatim_quote=quote,
            source_chunk_id=source_chunk_id,
            protocol_reference=protocol_reference,
            model=self.model,
            prompt_payload={"scripted": True, "rule_id": rule.id},
            raw_response={"scripted": True, "expected_status": status},
        )


def _verbatim_excerpt(chunk_text: str, limit: int = 200) -> str:
    """A contiguous substring of the chunk (skipping a leading heading line),
    guaranteed to ground against the canonical text."""
    for paragraph in chunk_text.split("\n\n"):
        stripped = paragraph.strip()
        if stripped and not stripped.startswith("#"):
            return stripped[:limit]
    return chunk_text[:limit]
