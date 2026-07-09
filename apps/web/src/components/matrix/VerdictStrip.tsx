// Visual hierarchy #1: the overall review verdict, before anything else.

import type { FindingOut } from "../../api/types";
import { STATUS_META } from "../../lib/status";

export function VerdictStrip({
  findings,
  ruleCount,
}: {
  findings: FindingOut[];
  ruleCount: number;
}) {
  const issues = findings.filter((f) => f.status !== "satisfied");
  const clean = issues.length === 0;

  return (
    <div
      role="status"
      className={`border-b px-4 py-3 ${
        clean
          ? "border-emerald-100 bg-emerald-50/70"
          : "border-red-100 bg-red-50/60"
      }`}
    >
      <div
        className={`text-sm font-semibold ${
          clean ? "text-emerald-800" : "text-red-800"
        }`}
      >
        {clean
          ? `All ${ruleCount} requirements satisfied`
          : `${issues.length} of ${ruleCount} requirements need attention`}
      </div>
      {!clean && (
        <div className="mt-1 flex flex-wrap gap-1">
          {issues.map((f) => {
            const meta = STATUS_META[f.status];
            return (
              <span
                key={f.id}
                className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${meta.chip}`}
              >
                <meta.Icon aria-hidden className="h-3 w-3" />
                {f.rule_title ?? f.rule_id}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
