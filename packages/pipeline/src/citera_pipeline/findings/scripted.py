"""Deterministic evaluator for tests and keyless development.

Not a lookup table: it judges the retrieved evidence with transparent
keyword heuristics (specific to the FDA demo rule set), so a clean ICF
and a defective ICF get different, correct verdicts. Quotes are verbatim
excerpts of the chunk carrying the signal, so findings pass the
span-grounding gate. Honestly labeled 'scripted-demo' in every audit
record — never a stand-in for Claude in a real review.
"""

from citera_schemas import RetrievedChunk, Rule

from citera_pipeline.findings.base import EvaluationOutcome

_CANNED_REASONING = {
    "satisfied": (
        "The quoted ICF text addresses this requirement and is consistent "
        "with the study protocol. [scripted evaluator]"
    ),
    "partial": (
        "The quoted ICF text mentions the availability of care but does not "
        "explain whether costs are covered or compensation is available, so "
        "the element is only partially satisfied. [scripted evaluator]"
    ),
    "conflicting": (
        "The quoted ICF text claims the drug is well tolerated with no "
        "serious side effects, contradicting the protocol's documented "
        "hepatic and hypersensitivity risks. [scripted evaluator]"
    ),
    "not_found": (
        "None of the retrieved evidence is relevant to this requirement; "
        "the element appears to be absent from the document. [scripted evaluator]"
    ),
}

_PROTOCOL_REFERENCE = (
    "Protocol §6 Risks and Safety Considerations documents elevated liver "
    "enzymes (~3%, monitored every visit) and a serious hypersensitivity "
    "reaction (angioedema). [scripted]"
)


class ScriptedEvaluator:
    model = "scripted-demo"

    def __init__(self, fabricate: frozenset[str] | set[str] = frozenset()):
        # rules whose quote is deliberately ungroundable (grounding-gate tests)
        self._fabricate = set(fabricate)

    async def evaluate(
        self,
        rule: Rule,
        evidence: list[RetrievedChunk],
        protocol_text: str | None,
    ) -> EvaluationOutcome:
        status, chunk, keyword = self._judge(rule.id, evidence)

        quote: str | None = None
        source_chunk_id: str | None = None
        if rule.id in self._fabricate:
            quote = "This exact sentence does not appear anywhere in the document."
            source_chunk_id = str(evidence[0].chunk_id) if evidence else None
        elif chunk is not None:
            quote = _verbatim_excerpt(chunk.text, keyword)
            source_chunk_id = str(chunk.chunk_id)

        return EvaluationOutcome(
            status=status,
            reasoning=_CANNED_REASONING[status],
            verbatim_quote=quote,
            source_chunk_id=source_chunk_id,
            protocol_reference=(
                _PROTOCOL_REFERENCE if status == "conflicting" else None
            ),
            model=self.model,
            prompt_payload={"scripted": True, "rule_id": rule.id},
            raw_response={
                "scripted": True,
                "status": status,
                "signal_keyword": keyword,
            },
        )

    def _judge(
        self, rule_id: str, evidence: list[RetrievedChunk]
    ) -> tuple[str, RetrievedChunk | None, str | None]:
        """(status, signal chunk, signal keyword) from evidence content."""
        if not evidence:
            return "not_found", None, None

        if rule_id.endswith("a8-voluntary"):
            chunk = _first_containing(evidence, "voluntary")
            if chunk is None:
                return "not_found", None, None
            return "satisfied", chunk, "voluntary"

        if rule_id.endswith("a2-risks"):
            liver = _first_containing(evidence, "liver")
            if liver is not None:
                return "satisfied", liver, "liver"
            tolerated = _first_containing(evidence, "well tolerated")
            if tolerated is not None:
                return "conflicting", tolerated, "well tolerated"
            return "satisfied", evidence[0], None

        if rule_id.endswith("a6-injury-compensation"):
            pays = _first_containing(evidence, "pay the reasonable costs")
            if pays is not None:
                return "satisfied", pays, "pay the reasonable costs"
            care_only = _first_containing(evidence, "medical care is available")
            if care_only is not None:
                return "partial", care_only, "medical care is available"
            return "satisfied", evidence[0], None

        return "satisfied", evidence[0], None


def _first_containing(
    evidence: list[RetrievedChunk], keyword: str
) -> RetrievedChunk | None:
    for chunk in evidence:
        if keyword in chunk.text.lower():
            return chunk
    return None


def _verbatim_excerpt(
    chunk_text: str, keyword: str | None = None, limit: int = 200
) -> str:
    """A contiguous substring of the chunk — the paragraph carrying the
    signal keyword when given, else the first non-heading paragraph —
    guaranteed to ground against the canonical text."""
    paragraphs = [p.strip() for p in chunk_text.split("\n\n")]
    if keyword:
        for paragraph in paragraphs:
            if keyword in paragraph.lower():
                return paragraph[:limit]
    for paragraph in paragraphs:
        if paragraph and not paragraph.startswith("#"):
            return paragraph[:limit]
    return chunk_text[:limit]
