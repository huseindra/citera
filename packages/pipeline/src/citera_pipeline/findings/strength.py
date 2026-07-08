"""Evidence strength derived from observable signals — retrieval rank and
grounding method — never from LLM self-confidence, which is uncalibrated
and would undermine the trust the product sells."""

from citera_schemas import EvidenceStrength


def derive_strength(source_rank: int | None, grounding_method: str) -> EvidenceStrength:
    if grounding_method == "exact" and source_rank is not None and source_rank <= 3:
        return EvidenceStrength.STRONG
    if source_rank is not None and source_rank <= 8:
        return EvidenceStrength.MODERATE
    return EvidenceStrength.WEAK
