import { describe, expect, it } from "vitest";
import type { FindingOut, RuleOut } from "../api/types";
import { COVERAGE_META, computeCoverage, IMPACT_LABEL, readinessVerdict } from "./coverage";

function rule(id: string, severity = "critical"): RuleOut {
  return {
    id,
    citation: "cite",
    title: id,
    description: "",
    severity,
    statutory_refs: [],
    remediation: null,
  };
}

function finding(rule_id: string, status: FindingOut["status"]): FindingOut {
  return {
    id: `f-${rule_id}`,
    rule_id,
    rule_title: rule_id,
    citation: "cite",
    severity: "critical",
    status,
    reasoning: "",
    verbatim_quote: null,
    span: null,
    evidence_strength: null,
    protocol_reference: null,
    queries_executed: null,
    suggested_revision: null,
    source: "engine" as const,
    reviewer_name: null,
    created_at: "",
  };
}

describe("computeCoverage", () => {
  it("summarizes evidence completeness against the ruleset", () => {
    const rules = [rule("a"), rule("b"), rule("c"), rule("d")];
    const findings = [
      finding("a", "satisfied"), // 100
      finding("b", "partial"), // 70
      finding("c", "not_found"), // 10
      finding("d", "conflicting"), // 35
    ];
    const s = computeCoverage(rules, findings);
    expect(s.total).toBe(4);
    expect(s.passed).toBe(1);
    expect(s.percent).toBe(Math.round((100 + 70 + 10 + 35) / 4));
    expect(s.rows.map((r) => r.meta?.label)).toEqual([
      "Verified",
      "Partial",
      "Missing",
      "Conflicting",
    ]);
  });

  it("pending rules count as zero coverage, never inflate the score", () => {
    const s = computeCoverage([rule("a"), rule("b")], [finding("a", "satisfied")]);
    expect(s.percent).toBe(50);
    expect(s.rows[1].finding).toBeNull();
    expect(s.rows[1].meta).toBeNull();
  });

  it("empty ruleset yields zero, not NaN", () => {
    expect(computeCoverage([], []).percent).toBe(0);
  });

  it("every status has a paired human label (never percentages alone)", () => {
    for (const meta of Object.values(COVERAGE_META)) {
      expect(meta.label.length).toBeGreaterThan(0);
    }
  });

  it("maps regulatory severity to reviewer impact", () => {
    expect(IMPACT_LABEL["critical"]).toBe("Critical");
    expect(IMPACT_LABEL["major"]).toBe("Medium");
    expect(IMPACT_LABEL["minor"]).toBe("Low");
  });
});

describe("readinessVerdict", () => {
  it("all passed -> Ready for Review", () => {
    const s = computeCoverage([rule("a")], [finding("a", "satisfied")]);
    expect(readinessVerdict(s.rows, s.passed, s.total).label).toBe(
      "Ready for Review",
    );
  });

  it("critical unresolved finding always blocks readiness", () => {
    const s = computeCoverage(
      [rule("a", "critical"), rule("b")],
      [finding("a", "conflicting"), finding("b", "satisfied")],
    );
    expect(readinessVerdict(s.rows, s.passed, s.total).label).toBe(
      "Not ready — critical findings",
    );
  });

  it("minor gaps -> Needs attention", () => {
    const s = computeCoverage(
      [rule("a", "minor"), rule("b", "minor")],
      [finding("a", "partial"), finding("b", "satisfied")],
    );
    expect(readinessVerdict(s.rows, s.passed, s.total).label).toBe(
      "Needs attention",
    );
  });
});
