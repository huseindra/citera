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

# per-pack protocol references for conflicting findings, keyed by rule-id
# prefix — the scripted evaluator quotes the right synthetic protocol
_PROTOCOL_REFERENCES = {
    "fda": (
        "Protocol §6 Risks and Safety Considerations documents elevated liver "
        "enzymes (~3%, monitored every visit) and a serious hypersensitivity "
        "reaction (angioedema). [scripted]"
    ),
    "hsa": (
        "Protocol §6 Risks and Safety Considerations documents elevated liver "
        "enzymes (~4%, monitored at every visit) and a moderate "
        "hypersensitivity reaction (urticaria). [scripted]"
    ),
    "tga": (
        "Protocol §5 Risks and Safety Considerations documents elevated liver "
        "enzymes (~3%, monitored at every visit) and symptomatic hypotension "
        "(6%). [scripted]"
    ),
    "bpom": (
        "Protokol §5 Risiko dan Pertimbangan Keselamatan mendokumentasikan "
        "peningkatan enzim hati (~3%, dipantau setiap kunjungan) dan reaksi "
        "hipersensitivitas (urtikaria). [scripted]"
    ),
}

# Deterministic drafts, consistent with the demo protocol — plain,
# participant-friendly language mirroring what the Claude evaluator is
# asked to produce. Only for statuses where action is needed.
_CANNED_REVISIONS = {
    "partial": (
        "If you are injured as a result of taking part in this study, medical "
        "care is available to you, and the sponsor will pay the reasonable "
        "costs of treating research-related injuries. You do not give up any "
        "legal rights by signing this form. [scripted draft]"
    ),
    "conflicting": (
        "The study drug can cause side effects. In earlier studies, about 3 in "
        "100 participants developed elevated liver enzymes, and rare but "
        "serious allergic reactions (including angioedema) have occurred. Your "
        "liver function will be checked at every visit. [scripted draft]"
    ),
    "not_found": (
        "Taking part in this study is completely voluntary. You may refuse to "
        "participate or stop at any time, without penalty or loss of benefits "
        "to which you are otherwise entitled. [scripted draft]"
    ),
}


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
        *,
        include_suggested_revision: bool = False,
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
                _PROTOCOL_REFERENCES.get(rule.id.split("-")[0], _PROTOCOL_REFERENCES["fda"])
                if status == "conflicting"
                else None
            ),
            suggested_revision=(
                _CANNED_REVISIONS.get(status)
                if include_suggested_revision
                else None
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
        """(status, signal chunk, signal keyword) from evidence content.

        Keyword tiers are pack-agnostic (English + Indonesian): the demo
        corpora of every jurisdiction plant the same defect archetypes —
        an understated risk section, an incomplete injury-compensation
        promise, and one missing required element."""
        if not evidence:
            return "not_found", None, None

        for suffix, tiers in _KEYWORD_JUDGMENTS:
            if rule_id.endswith(suffix):
                for status, keywords in tiers:
                    for keyword in keywords:
                        chunk = _first_containing(evidence, keyword)
                        if chunk is not None:
                            return status, chunk, keyword
                # no tier matched: the element is absent from the evidence
                return "not_found", None, None

        return "satisfied", evidence[0], None


# (rule-id suffix, [(status, keywords)] tried in order). First keyword
# found in any evidence chunk wins; nothing found -> not_found.
_KEYWORD_JUDGMENTS: list[tuple[str, list[tuple[str, list[str]]]]] = [
    ("risks", [
        ("satisfied", ["liver", "enzim hati"]),
        ("conflicting", ["well tolerated", "sangat aman"]),
    ]),
    ("injury-compensation", [
        ("satisfied", ["pay the reasonable costs", "ditanggung oleh sponsor"]),
        ("partial", ["medical care is available", "pengobatan tersedia"]),
    ]),
    ("voluntary", [
        ("satisfied", ["voluntary", "sukarela"]),
    ]),
    ("tissue", [
        ("satisfied", ["outside singapore", "exported", "shipped"]),
    ]),
    ("ku17-insurance", [
        ("satisfied", ["asuransi"]),
        ("partial", ["ditanggung"]),
    ]),
    ("4811-copy", [
        ("satisfied", ["salinan"]),
    ]),
    ("489-witness", [
        ("satisfied", ["saksi"]),
    ]),
    ("data-withdrawal", [
        ("satisfied", ["withdraw your data", "data collected up to", "no further data"]),
    ]),
    ("contacts-complaints", [
        ("satisfied", ["complaint"]),
        ("partial", ["contact"]),
    ]),
]


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
