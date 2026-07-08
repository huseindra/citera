import { useMemo, useRef } from "react";
import type { FindingOut, RuleOut } from "../../api/types";
import { SEVERITY_ORDER, STATUS_META } from "../../lib/status";

interface Props {
  rules: RuleOut[];
  findings: FindingOut[];
  running: boolean;
  selectedId: string | null;
  onSelect: (findingId: string) => void;
}

type Row =
  | { kind: "finding"; rule: RuleOut | null; finding: FindingOut }
  | { kind: "evaluating" | "queued"; rule: RuleOut };

export function CoverageMatrix({
  rules,
  findings,
  running,
  selectedId,
  onSelect,
}: Props) {
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  const rows = useMemo<Row[]>(() => {
    const byRule = new Map(findings.map((f) => [f.rule_id, f]));
    if (running || rules.length === 0) {
      // THEATER: ruleset order; the next unfinished rule is live
      // (the orchestrator evaluates sequentially and commits per rule)
      const ruleRows: Row[] = rules.map((rule, index) => {
        const finding = byRule.get(rule.id);
        if (finding) return { kind: "finding", rule, finding };
        return {
          kind: index === findings.length ? "evaluating" : "queued",
          rule,
        };
      });
      if (rules.length === 0) {
        return findings.map((finding) => ({ kind: "finding", rule: null, finding }));
      }
      return ruleRows;
    }
    // complete: problems first, by severity
    const ruleById = new Map(rules.map((r) => [r.id, r]));
    return [...findings]
      .sort((a, b) => {
        const byStatus = STATUS_META[a.status].order - STATUS_META[b.status].order;
        if (byStatus !== 0) return byStatus;
        return (
          (SEVERITY_ORDER[a.severity ?? "minor"] ?? 9) -
          (SEVERITY_ORDER[b.severity ?? "minor"] ?? 9)
        );
      })
      .map((finding) => ({
        kind: "finding",
        rule: ruleById.get(finding.rule_id) ?? null,
        finding,
      }));
  }, [rules, findings, running]);

  const moveFocus = (delta: number) => {
    const focusables = bodyRef.current?.querySelectorAll<HTMLElement>("[tabindex]");
    if (!focusables?.length) return;
    const current = Array.from(focusables).indexOf(
      document.activeElement as HTMLElement,
    );
    const next = Math.min(Math.max(current + delta, 0), focusables.length - 1);
    focusables[next]?.focus();
  };

  return (
    <div className="h-full overflow-y-auto bg-stone-50/60">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          Regulation coverage matrix: one row per requirement with its
          compliance status
        </caption>
        <thead className="sticky top-0 z-10 bg-stone-50 text-[11px] text-stone-400">
          <tr className="border-b border-stone-200">
            <th scope="col" className="px-4 py-2 font-medium">
              Status
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              Requirement
            </th>
          </tr>
        </thead>
        <tbody ref={bodyRef}>
          {rows.map((row) =>
            row.kind === "finding" ? (
              <FindingRow
                key={row.finding.id}
                row={row}
                isSelected={row.finding.id === selectedId}
                onSelect={onSelect}
                onMove={moveFocus}
              />
            ) : (
              <PendingRow key={row.rule.id} row={row} />
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function FindingRow({
  row,
  isSelected,
  onSelect,
  onMove,
}: {
  row: Extract<Row, { kind: "finding" }>;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (delta: number) => void;
}) {
  const { finding } = row;
  const meta = STATUS_META[finding.status];
  return (
    <tr
      tabIndex={0}
      aria-selected={isSelected}
      onClick={() => onSelect(finding.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(finding.id);
        } else if (e.key === "ArrowDown" || e.key === "j") {
          e.preventDefault();
          onMove(1);
        } else if (e.key === "ArrowUp" || e.key === "k") {
          e.preventDefault();
          onMove(-1);
        }
      }}
      className={`cursor-pointer border-b border-stone-100 align-top outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-stone-400 ${
        isSelected ? "bg-white shadow-sm" : ""
      }`}
    >
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${meta.chip}`}
        >
          <span aria-hidden>{meta.icon}</span>
          {meta.label}
        </span>
      </td>
      <td className="px-2 py-3">
        <div className="font-medium text-stone-800">
          {finding.rule_title ?? finding.rule_id}
        </div>
        <div className="text-xs text-stone-400">
          {finding.citation}
          {finding.severity ? ` · ${finding.severity}` : ""}
        </div>
        {finding.status === "not_found" && finding.queries_executed && (
          <div className="mt-1 text-xs text-violet-700">
            Searched {finding.queries_executed.length} queries — no relevant
            evidence found.
          </div>
        )}
      </td>
    </tr>
  );
}

function PendingRow({ row }: { row: Extract<Row, { kind: "evaluating" | "queued" }> }) {
  const evaluating = row.kind === "evaluating";
  return (
    <tr className="border-b border-stone-100 align-top" aria-busy={evaluating}>
      <td className="px-4 py-3">
        {evaluating ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
            </span>
            Claude evaluating…
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-stone-200 bg-white px-2 py-0.5 text-xs text-stone-400">
            queued
          </span>
        )}
      </td>
      <td className="px-2 py-3">
        <div className={`font-medium ${evaluating ? "text-stone-700" : "text-stone-400"}`}>
          {row.rule.title}
        </div>
        <div className="text-xs text-stone-400">
          {row.rule.citation} · {row.rule.severity}
        </div>
        {evaluating && (
          <div className="mt-1.5 h-1 w-40 overflow-hidden rounded-full bg-stone-100">
            <div className="theater-shimmer h-full w-1/3 rounded-full bg-sky-300" />
          </div>
        )}
      </td>
    </tr>
  );
}
