import pytest
from citera_rulesets import (
    RulesetError,
    available_rulesets,
    load_ruleset,
    registry,
    resolve_ruleset_id,
)
from citera_schemas import Severity

SHIPPED = ["bpom-cukb", "fda-21cfr50", "hsa-hpct2016", "tga-ns-ichgcp"]


def test_shipped_packs_present():
    assert available_rulesets() == SHIPPED


def test_fda_ruleset_loads_eight_valid_rules():
    ruleset = load_ruleset("fda-21cfr50")
    assert ruleset.id == "fda-21cfr50"
    assert ruleset.authority == "FDA"
    assert len(ruleset.rules) == 8
    ids = [r.id for r in ruleset.rules]
    assert len(set(ids)) == 8
    for rule in ruleset.rules:
        assert rule.citation.startswith("21 CFR 50.25")
        assert rule.retrieval_queries
        assert rule.evaluation_criteria


def test_every_shipped_pack_is_valid_and_self_describing():
    """The engine is jurisdiction-agnostic — a pack must carry everything."""
    for pack_id in SHIPPED:
        pack = load_ruleset(pack_id)
        assert pack.version
        assert pack.authority
        assert pack.jurisdiction
        assert pack.languages
        assert pack.aliases
        for rule in pack.rules:
            assert rule.retrieval_queries, rule.id
            assert rule.evaluation_criteria, rule.id
            # native statutory granularity is preserved on grouped rules
            assert rule.statutory_refs, rule.id
            assert rule.remediation, rule.id


def test_hsa_pack_never_references_hbra():
    """HBRA excludes drug trials (Second Schedule) — the pack must cite
    the Health Products (Clinical Trials) Regulations only."""
    pack = load_ruleset("hsa-hpct2016")
    for rule in pack.rules:
        text = " ".join(
            [rule.citation, rule.description, rule.evaluation_criteria]
            + rule.statutory_refs
        )
        assert "HBRA" not in text, rule.id
        assert "Human Biomedical Research Act" not in text, rule.id


def test_hsa_pack_covers_all_reg19_letters():
    refs = " ".join(
        ref for r in load_ruleset("hsa-hpct2016").rules for ref in r.statutory_refs
    )
    for letter in "abcdefghijklmnopqrst":
        assert f"({letter})" in refs, f"reg 19(1)({letter}) uncovered"
    assert "(ta)" in refs


def test_bpom_pack_is_indonesian_first():
    pack = load_ruleset("bpom-cukb")
    assert pack.languages[0] == "id"
    # retrieval must target Indonesian ICFs: every content rule leads
    # with Indonesian queries
    indonesian_markers = ("penelitian", "uji", "risiko", "biaya", "subjek",
                          "kerahasiaan", "sukarela", "saksi", "salinan",
                          "asuransi", "kompensasi", "prosedur", "manfaat",
                          "tanggung", "alokasi", "informasi", "hubungi",
                          "berapa", "alternatif", "keikutsertaan", "pembayaran")
    for rule in pack.rules:
        first = rule.retrieval_queries[0].lower()
        assert any(m in first for m in indonesian_markers), (rule.id, first)


def test_bpom_pack_includes_structural_rules():
    ids = {r.id for r in load_ruleset("bpom-cukb").rules}
    assert "bpom-489-witness" in ids
    assert "bpom-4811-copy" in ids
    assert "bpom-ku17-insurance" in ids


def test_bpom_pack_covers_cukb_4810_letters():
    refs = " ".join(
        ref for r in load_ruleset("bpom-cukb").rules for ref in r.statutory_refs
    )
    for letter in "abcdefghijklmnopqrst":
        assert f"huruf {letter}" in refs, f"4.8.10 huruf {letter} uncovered"


def test_tga_rules_carry_dual_gcp_citations():
    """E6(R2)→E6(R3) transition: every rule citing GCP must cite both."""
    for rule in load_ruleset("tga-ns-ichgcp").rules:
        refs = " ".join(rule.statutory_refs)
        if "E6(R2)" in refs or "E6(R3)" in refs:
            has_r2 = "E6(R2)" in refs
            has_r3 = "E6(R3)" in refs
            # NS-only rules are fine; GCP-derived rules cite both editions
            # unless the element is new in R3 (no R2 counterpart exists)
            if has_r2:
                assert has_r3, rule.id


def test_registry_status_lifecycle():
    entries = {e["id"]: e for e in registry()}
    assert entries["fda-21cfr50"]["status"] == "available"
    for dev_id in ("hsa-hpct2016", "bpom-cukb", "tga-ns-ichgcp"):
        entry = entries[dev_id]
        assert entry["status"] == "in_development"
        # in-development packs are versioned and counted — shipped, not vapor
        assert entry["version"] == "v0.1.0"
        assert entry["rule_count"] > 0
    for roadmap_id in ("pmda", "ema", "mhra", "hc", "nmpa"):
        assert entries[roadmap_id]["status"] == "roadmap"
        assert entries[roadmap_id]["version"] is None


def test_alias_resolution():
    assert resolve_ruleset_id("fda") == "fda-21cfr50"
    assert resolve_ruleset_id("hsa") == "hsa-hpct2016"
    assert resolve_ruleset_id("bpom") == "bpom-cukb"
    assert resolve_ruleset_id("tga") == "tga-ns-ichgcp"
    # ids and unknowns pass through
    assert resolve_ruleset_id("fda-21cfr50") == "fda-21cfr50"
    assert resolve_ruleset_id("nope") == "nope"


def test_planted_defects_each_map_to_a_rule():
    """The ICF-B answer key depends on these three rules existing."""
    ids = {r.id for r in load_ruleset("fda-21cfr50").rules}
    assert "fda-50.25-a2-risks" in ids  # conflicting
    assert "fda-50.25-a6-injury-compensation" in ids  # partial
    assert "fda-50.25-a8-voluntary" in ids  # not_found


def test_critical_rules_marked_critical():
    by_id = {r.id: r for r in load_ruleset("fda-21cfr50").rules}
    assert by_id["fda-50.25-a2-risks"].severity == Severity.CRITICAL
    assert by_id["fda-50.25-a8-voluntary"].severity == Severity.CRITICAL


def test_unknown_ruleset_fails_loudly():
    with pytest.raises(RulesetError, match="Unknown ruleset"):
        load_ruleset("does-not-exist")
