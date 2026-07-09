// Evidence Coverage — the regulatory readiness dashboard. Answers, in
// three seconds: how complete is this ICF, which requirements are
// satisfied, and what still needs attention. Built ONLY from verified
// findings against the ruleset — no embeddings, no retrieval or model
// confidence, no AI implementation details.

import { ArrowRight, X as XIcon } from "lucide-react";
import { useState } from "react";
import type { FindingOut, RuleOut } from "../../api/types";
import { computeCoverage } from "../../lib/coverage";
import { EvidenceMatrixModal } from "./EvidenceMatrixModal";

interface Props {
  rules: RuleOut[];
  findings: FindingOut[];
  onSelect: (findingId: string) => void;
  onClose: () => void;
}

export function EvidenceCoverage({ rules, findings, onSelect, onClose }: Props) {
  const [matrixOpen, setMatrixOpen] = useState(false);
  const summary = computeCoverage(rules, findings);

  return (
    <div className="absolute bottom-3 right-3 top-3 z-20 flex w-80 flex-col rounded-xl border border-stone-200 bg-white shadow-lg shadow-stone-900/5">
      <div className="flex items-start justify-between border-b border-stone-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-stone-800">
            Evidence Coverage
          </h3>
          <p className="text-[11px] text-stone-400">
            Evidence completeness against the ruleset
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close evidence coverage"
          className="rounded-md px-2 py-1 text-stone-400 hover:bg-stone-100"
        >
          <XIcon aria-hidden className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-stone-100 px-4 py-3">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-stone-900">
            {summary.percent}%
          </div>
          <div className="text-[10px] uppercase tracking-wide text-stone-400">
            Evidence coverage
          </div>
        </div>
        <div>
          <div className="text-2xl font-semibold tracking-tight text-stone-900">
            {summary.passed}
            <span className="text-stone-400"> / {summary.total}</span>
          </div>
          <div className="text-[10px] uppercase tracking-wide text-stone-400">
            Requirements passed
          </div>
        </div>
      </div>

      <ol className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
        {summary.rows.map(({ rule, finding, meta }) => (
          <li key={rule.id}>
            <button
              onClick={() => finding && onSelect(finding.id)}
              disabled={!finding}
              className="w-full rounded-lg px-1.5 py-1 text-left transition-colors enabled:hover:bg-stone-50 disabled:cursor-default"
              title={finding ? "Open the finding dossier" : "Not evaluated yet"}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-medium text-stone-800">
                  {rule.title}
                </span>
                <span
                  className={`shrink-0 text-[11px] font-medium ${meta?.text ?? "text-stone-400"}`}
                >
                  {meta?.label ?? "Pending"}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
                <div
                  className={`h-full rounded-full ${meta?.bar ?? "bg-stone-200"}`}
                  style={{ width: `${meta?.percent ?? 0}%` }}
                />
              </div>
            </button>
          </li>
        ))}
      </ol>

      <div className="border-t border-stone-100 px-4 py-2.5">
        <button
          onClick={() => setMatrixOpen(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          Open Evidence Matrix <ArrowRight aria-hidden className="h-3 w-3" />
        </button>
      </div>

      {matrixOpen && (
        <EvidenceMatrixModal
          rules={rules}
          findings={findings}
          onSelect={(id) => {
            setMatrixOpen(false);
            onSelect(id);
          }}
          onClose={() => setMatrixOpen(false)}
        />
      )}
    </div>
  );
}
