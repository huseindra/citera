from citera_pipeline.findings import derive_strength
from citera_schemas import EvidenceStrength


def test_exact_top3_is_strong():
    assert derive_strength(1, "exact") == EvidenceStrength.STRONG
    assert derive_strength(3, "exact") == EvidenceStrength.STRONG


def test_normalized_or_lower_rank_is_moderate():
    assert derive_strength(1, "normalized") == EvidenceStrength.MODERATE
    assert derive_strength(8, "exact") == EvidenceStrength.MODERATE


def test_unknown_rank_is_weak():
    assert derive_strength(None, "exact") == EvidenceStrength.WEAK
