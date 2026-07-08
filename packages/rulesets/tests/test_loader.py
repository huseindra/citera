import pytest
from citera_rulesets import RulesetError, available_rulesets, load_ruleset
from citera_schemas import Severity


def test_fda_ruleset_is_available():
    assert "fda-21cfr50" in available_rulesets()


def test_fda_ruleset_loads_eight_valid_rules():
    ruleset = load_ruleset("fda-21cfr50")
    assert ruleset.id == "fda-21cfr50"
    assert len(ruleset.rules) == 8
    ids = [r.id for r in ruleset.rules]
    assert len(set(ids)) == 8
    # every rule cites the regulation and can drive retrieval
    for rule in ruleset.rules:
        assert rule.citation.startswith("21 CFR 50.25")
        assert rule.retrieval_queries
        assert rule.evaluation_criteria


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
