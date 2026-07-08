import { useMemo } from "react";
import type { FindingOut } from "../../api/types";
import { SEVERITY_ORDER, STATUS_META } from "../../lib/status";

interface Props {
  findings: FindingOut[];
  selectedId: string | null;
  onSelect: (findingId: string) => void;
}

export function CoverageMatrix({ findings, selectedId, onSelect }: Props) {
  const rows = useMemo(
    () =>
      [...findings].sort((a, b) => {
        const byStatus =
          STATUS_META[a.status].order - STATUS_META[b.status].order;
        if (byStatus !== 0) return byStatus;
        return (
          (SEVERITY_ORDER[a.severity ?? "minor"] ?? 9) -
          (SEVERITY_ORDER[b.severity ?? "minor"] ?? 9)
        );
      }),
    [findings],
  );

  return (
    <div className="h-full overflow-y-auto bg-stone-50">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          Regulation coverage matrix: one row per requirement with its
          compliance status
        </caption>
        <thead className="sticky top-0 bg-stone-50 text-xs text-stone-500">
          <tr className="border-b border-stone-200">
            <th scope="col" className="px-4 py-2 font-medium">
              Status
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              Requirement
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Evidence
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => {
            const meta = STATUS_META[f.status];
            const isSelected = f.id === selectedId;
            return (
              <tr
                key={f.id}
                tabIndex={0}
                aria-selected={isSelected}
                onClick={() => onSelect(f.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(f.id);
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
                    {f.rule_title ?? f.rule_id}
                  </div>
                  <div className="text-xs text-stone-500">
                    {f.citation}
                    {f.severity ? ` · ${f.severity}` : ""}
                  </div>
                  {f.status === "not_found" && f.queries_executed && (
                    <div className="mt-1 text-xs text-violet-700">
                      Searched {f.queries_executed.length} queries — no
                      relevant evidence found.
                    </div>
                  )}
                  {isSelected && (
                    <p className="mt-2 text-xs leading-5 text-stone-600">
                      {f.reasoning}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-stone-500">
                  {f.evidence_strength ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
