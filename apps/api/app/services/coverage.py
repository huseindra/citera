"""Evidence coverage — regulatory readiness computed at the canonical
REST layer so every interface (Playground, SDK, MCP) reports identical
readiness for the same review.

Coverage represents evidence completeness against the selected ruleset:
nothing here reads embeddings, retrieval scores, or model confidence.
Percentages are never shown alone; every value is paired with a
human-readable status label. Weights mirror the Playground's
Evidence Coverage panel exactly.
"""

from dataclasses import dataclass

# satisfied = verified evidence fully covers the requirement (100).
# partial = verified evidence exists but incomplete (70).
# conflicting = evidence exists but contradicts the protocol — worse
# than incomplete, better than absent (35).
# not_found = no evidence of the element (10, absence itself verified).
# evaluation_failed = nothing trustworthy to count (0).
COVERAGE_PERCENT: dict[str, int] = {
    "satisfied": 100,
    "partial": 70,
    "conflicting": 35,
    "not_found": 10,
    "evaluation_failed": 0,
}

COVERAGE_LABEL: dict[str, str] = {
    "satisfied": "Verified",
    "partial": "Partial",
    "conflicting": "Conflicting",
    "not_found": "Missing",
    "evaluation_failed": "Not evaluated",
}

# Reviewer-facing impact from the rule's regulatory severity.
IMPACT_LABEL: dict[str, str] = {
    "critical": "Critical",
    "major": "Medium",
    "minor": "Low",
}


@dataclass
class CoverageRow:
    rule_id: str
    rule_title: str
    citation: str
    severity: str
    impact: str
    status: str | None  # None = rule not evaluated (no finding)
    label: str
    percent: int


@dataclass
class CoverageSummary:
    percent: int
    passed: int
    total: int
    verdict: str
    rows: list[CoverageRow]


def readiness_verdict(rows: list[CoverageRow], passed: int, total: int) -> str:
    """Honest executive verdict: derived from findings, never from a
    score alone. Critical unresolved findings always block readiness."""
    blocking = any(
        row.status is not None
        and row.status != "satisfied"
        and row.severity == "critical"
        for row in rows
    )
    if total > 0 and passed == total:
        return "Ready for Review"
    if blocking:
        return "Not ready — critical findings"
    return "Needs attention"


def compute_coverage(rules, findings) -> CoverageSummary:
    """rules: ruleset Rule objects; findings: Finding ORM rows."""
    by_rule = {f.rule_id: f for f in findings}
    rows: list[CoverageRow] = []
    for rule in rules:
        finding = by_rule.get(rule.id)
        status = finding.status if finding is not None else None
        rows.append(
            CoverageRow(
                rule_id=rule.id,
                rule_title=rule.title,
                citation=rule.citation,
                severity=rule.severity.value,
                impact=IMPACT_LABEL.get(rule.severity.value, rule.severity.value),
                status=status,
                label=COVERAGE_LABEL.get(status, "Pending") if status else "Pending",
                percent=COVERAGE_PERCENT.get(status, 0) if status else 0,
            )
        )

    total = len(rows)
    passed = sum(1 for row in rows if row.status == "satisfied")
    percent = (
        0 if total == 0 else round(sum(row.percent for row in rows) / total)
    )
    return CoverageSummary(
        percent=percent,
        passed=passed,
        total=total,
        verdict=readiness_verdict(rows, passed, total),
        rows=rows,
    )
