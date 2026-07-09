// Compact ruleset picker for the one-screen sidebar: a native select with
// Available / Preview groups. Preview rulesets are selectable so the
// developer discovers them, but selecting one honestly explains that
// support is in development (the API would 422) — never fake a review.

import { useQuery } from "@tanstack/react-query";
import { Construction } from "lucide-react";
import { apiGet } from "../../api/client";
import type { RulesetInfo } from "../../api/types";

interface Props {
  value: string;
  onChange: (rulesetId: string) => void;
}

export function RulesetSelector({ value, onChange }: Props) {
  const rulesets = useQuery({
    queryKey: ["rulesets"],
    queryFn: () => apiGet<RulesetInfo[]>("/rulesets"),
    staleTime: Infinity,
  });

  const entries = rulesets.data ?? [];
  const available = entries.filter((r) => r.status === "available");
  const preview = entries.filter((r) => r.status === "preview");
  const roadmap = entries.filter((r) => r.status === "roadmap");
  const selected = entries.find((r) => r.id === value);

  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
        Ruleset
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-xs font-medium text-stone-800"
      >
        <optgroup label="Available">
          {available.map((r) => (
            <option key={r.id} value={r.id}>
              {r.authority} — {r.name}
            </option>
          ))}
        </optgroup>
        {preview.length > 0 && (
          <optgroup label="Preview">
            {preview.map((r) => (
              <option key={r.id} value={r.id}>
                {r.authority} — {r.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      {selected?.status === "available" && (
        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-stone-400">
          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">
            Available
          </span>
          <span>{selected.jurisdiction}</span>
          {selected.version && <span>· {selected.version}</span>}
          {selected.rule_count != null && <span>· {selected.rule_count} rules</span>}
        </div>
      )}
      {selected?.status === "preview" && (
        <p className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-4 text-amber-800">
          <Construction aria-hidden className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            {selected.authority} ({selected.jurisdiction}) support is in
            development — reviews cannot run against this ruleset yet.
          </span>
        </p>
      )}

      {roadmap.length > 0 && (
        <div className="mt-1.5 text-[10px] leading-4 text-stone-400">
          Roadmap: {roadmap.map((r) => r.authority).join(" · ")}
        </div>
      )}
    </div>
  );
}
