import { useQuery } from "@tanstack/react-query";
import { Construction } from "lucide-react";
import { useState } from "react";
import { apiGet } from "../../api/client";
import type { RulesetInfo } from "../../api/types";

interface Props {
  value: string;
  onChange: (rulesetId: string) => void;
}

export function RulesetSelector({ value, onChange }: Props) {
  const [previewNote, setPreviewNote] = useState<string | null>(null);
  const rulesets = useQuery({
    queryKey: ["rulesets"],
    queryFn: () => apiGet<RulesetInfo[]>("/rulesets"),
    staleTime: Infinity,
  });

  const entries = rulesets.data ?? [];
  const available = entries.filter((r) => r.status === "available");
  const preview = entries.filter((r) => r.status === "preview");
  const roadmap = entries.filter((r) => r.status === "roadmap");

  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
        Ruleset
      </div>
      <div className="mt-1.5 space-y-1.5">
        {available.map((r) => (
          <button
            key={r.id}
            onClick={() => onChange(r.id)}
            aria-pressed={value === r.id}
            className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
              value === r.id
                ? "border-stone-800 bg-white ring-1 ring-stone-800"
                : "border-stone-200 bg-white hover:border-stone-400"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-800">
                {r.authority}
              </span>
              <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                Available
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-stone-500">{r.name}</div>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-stone-400">
              <span>{r.jurisdiction}</span>
              {r.coverage && <span>· {r.coverage}</span>}
              {r.version && <span>· {r.version}</span>}
              {r.rule_count != null && <span>· {r.rule_count} rules</span>}
            </div>
          </button>
        ))}

        <div className="pt-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">
          Preview
        </div>
        {preview.map((r) => (
          <button
            key={r.id}
            onClick={() =>
              setPreviewNote(
                `${r.authority} (${r.jurisdiction}) support is currently in development — reviews cannot run against this ruleset yet.`,
              )
            }
            className="w-full rounded-lg border border-dashed border-stone-200 bg-stone-50/60 p-2.5 text-left opacity-75 hover:opacity-100"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-600">
                <Construction aria-hidden className="h-3 w-3" /> {r.authority}
              </span>
              <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                Preview
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-stone-400">{r.name}</div>
          </button>
        ))}
        {previewNote && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-4 text-amber-800">
            {previewNote}
          </p>
        )}

        {roadmap.length > 0 && (
          <>
            <div className="pt-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">
              Roadmap
            </div>
            <div className="flex flex-wrap gap-1">
              {roadmap.map((r) => (
                <span
                  key={r.id}
                  title={`${r.name} — planned`}
                  className="rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[10px] text-stone-400"
                >
                  {r.authority}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
