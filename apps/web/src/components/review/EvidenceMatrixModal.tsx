// The Evidence Matrix — the detailed readiness table behind the
// Evidence Coverage summary. One row per requirement: protocol context,
// ICF verdict, evidence verification, reviewer impact, status. Rows
// jump straight into the finding dossier.

import { BadgeCheck, Check, TriangleAlert, X as XIcon } from "lucide-react";
import { useEffect } from "react";
import type { FindingOut, FindingStatus, RuleOut } from "../../api/types";
import { computeCoverage, IMPACT_LABEL } from "../../lib/coverage";

interface Props {
  rules: RuleOut[];
  findings: FindingOut[];
  onSelect: (findingId: string) => void;
  onClose: () => void;
}

export function EvidenceMatrixModal({ rules, findings, onSelect, onClose }: Props) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const summary = computeCoverage(rules, findings);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-8 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-stone-100 px-5 py-3.5">
          <div>
            <h3 className="text-sm font-semibold text-stone-800">
              Evidence Matrix
            </h3>
            <p className="text-[11px] text-stone-400">
              {summary.percent}% evidence coverage · {summary.passed}/
              {summary.total} requirements passed
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close evidence matrix"
            className="rounded-md px-2 py-1 text-stone-400 hover:bg-stone-100"
          >
            <XIcon aria-hidden className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wide text-stone-400">
              <tr className="border-b border-stone-100">
                <th className="px-5 py-2 font-medium">Requirement</th>
                <th className="px-2 py-2 font-medium">Protocol</th>
                <th className="px-2 py-2 font-medium">ICF</th>
                <th className="px-2 py-2 font-medium">Evidence</th>
                <th className="px-2 py-2 font-medium">Impact</th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map(({ rule, finding, meta }) => (
                <tr
                  key={rule.id}
                  onClick={() => finding && onSelect(finding.id)}
                  className={`border-b border-stone-50 ${
                    finding ? "cursor-pointer hover:bg-stone-50" : "opacity-60"
                  }`}
                  title={finding ? "Open the finding dossier" : undefined}
                >
                  <td className="px-5 py-2.5">
                    <div className="font-medium text-stone-800">{rule.title}</div>
                    <div className="text-[10px] text-stone-400">{rule.citation}</div>
                  </td>
                  <td className="px-2 py-2.5">
                    <ProtocolCell finding={finding} />
                  </td>
                  <td className="px-2 py-2.5">
                    <IcfCell status={finding?.status ?? null} />
                  </td>
                  <td className="px-2 py-2.5">
                    <EvidenceCell finding={finding} />
                  </td>
                  <td className="px-2 py-2.5 text-stone-600">
                    {IMPACT_LABEL[rule.severity] ?? rule.severity}
                  </td>
                  <td className="px-5 py-2.5">
                    <span className={`font-medium ${meta?.text ?? "text-stone-400"}`}>
                      {meta?.label ?? "Pending"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Protocol context informed this finding (a cited protocol passage). */
function ProtocolCell({ finding }: { finding: FindingOut | null }) {
  if (!finding) return <span className="text-stone-300">—</span>;
  return finding.protocol_reference ? (
    <Check aria-hidden className="h-3.5 w-3.5 text-stone-500" />
  ) : (
    <span className="text-stone-300">—</span>
  );
}

function IcfCell({ status }: { status: FindingStatus | null }) {
  if (status === "satisfied")
    return <Check aria-hidden className="h-3.5 w-3.5 text-green-600" />;
  if (status === "partial")
    return <TriangleAlert aria-hidden className="h-3.5 w-3.5 text-amber-600" />;
  if (status === "conflicting" || status === "not_found")
    return <XIcon aria-hidden className="h-3.5 w-3.5 text-red-600" />;
  return <span className="text-stone-300">—</span>;
}

/** Honest evidence column: Verified only when the quote passed the
 *  span-grounding gate; absence is itself recorded evidence. */
function EvidenceCell({ finding }: { finding: FindingOut | null }) {
  if (!finding) return <span className="text-stone-300">—</span>;
  if (finding.span) {
    return (
      <span className="inline-flex items-center gap-1 text-green-600">
        <BadgeCheck aria-hidden className="h-3.5 w-3.5" /> Verified
      </span>
    );
  }
  if (finding.status === "not_found") {
    return <span className="text-stone-500">Absence recorded</span>;
  }
  return <span className="text-stone-300">—</span>;
}
