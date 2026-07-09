// Evidence Coverage — pure calculation of regulatory readiness from
// verified findings. Coverage represents evidence completeness against
// the selected ruleset: nothing here reads embeddings, retrieval scores,
// or model confidence. Percentages are never shown alone; every value is
// paired with a human-readable status (design principle: color + label).

import type { FindingOut, FindingStatus, RuleOut } from "../api/types";

export interface CoverageMeta {
  /** human-readable status, always shown next to the bar */
  label: string;
  /** evidence completeness for the bar fill */
  percent: number;
  bar: string;
  text: string;
}

// satisfied = verified evidence fully covers the requirement (100).
// partial = verified evidence exists but incomplete (70).
// conflicting = evidence exists but contradicts the protocol — worse
// than incomplete, better than absent (35).
// not_found = no evidence of the element (10, absence itself verified).
// evaluation_failed = nothing trustworthy to count (0).
export const COVERAGE_META: Record<FindingStatus, CoverageMeta> = {
  satisfied: {
    label: "Verified",
    percent: 100,
    bar: "bg-green-600",
    text: "text-green-600",
  },
  partial: {
    label: "Partial",
    percent: 70,
    bar: "bg-amber-600",
    text: "text-amber-600",
  },
  conflicting: {
    label: "Conflicting",
    percent: 35,
    bar: "bg-red-600",
    text: "text-red-600",
  },
  not_found: {
    label: "Missing",
    percent: 10,
    bar: "bg-red-600",
    text: "text-red-600",
  },
  evaluation_failed: {
    label: "Not evaluated",
    percent: 0,
    bar: "bg-stone-300",
    text: "text-stone-500",
  },
};

/** Reviewer-facing impact from the rule's regulatory severity. */
export const IMPACT_LABEL: Record<string, string> = {
  critical: "Critical",
  major: "Medium",
  minor: "Low",
};

export interface CoverageRow {
  rule: RuleOut;
  finding: FindingOut | null;
  meta: CoverageMeta | null;
}

export interface CoverageSummary {
  /** overall evidence completeness, 0–100 */
  percent: number;
  passed: number;
  total: number;
  rows: CoverageRow[];
}

/** Honest executive verdict: derived from findings, never from a score
 *  alone. Critical unresolved findings always block readiness. */
export function readinessVerdict(
  rows: CoverageRow[],
  passed: number,
  total: number,
): { label: string; tone: string } {
  const blocking = rows.some(
    (r) =>
      r.finding &&
      r.finding.status !== "satisfied" &&
      r.rule.severity === "critical",
  );
  if (total > 0 && passed === total) {
    return { label: "Ready for Review", tone: "text-green-600" };
  }
  if (blocking) {
    return { label: "Not ready — critical findings", tone: "text-red-600" };
  }
  return { label: "Needs attention", tone: "text-amber-600" };
}

export function computeCoverage(
  rules: RuleOut[],
  findings: FindingOut[],
): CoverageSummary {
  const byRule = new Map(findings.map((f) => [f.rule_id, f]));
  const rows: CoverageRow[] = rules.map((rule) => {
    const finding = byRule.get(rule.id) ?? null;
    return {
      rule,
      finding,
      meta: finding ? COVERAGE_META[finding.status] : null,
    };
  });

  const total = rules.length;
  const passed = rows.filter((r) => r.finding?.status === "satisfied").length;
  const percent =
    total === 0
      ? 0
      : Math.round(
          rows.reduce((sum, r) => sum + (r.meta?.percent ?? 0), 0) / total,
        );
  return { percent, passed, total, rows };
}
