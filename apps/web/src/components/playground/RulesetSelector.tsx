// Custom ruleset picker: a styled trigger + popover listbox with
// Available / In Development / Roadmap groups. Only available rulesets
// are selectable — clicking an in-development pack honestly explains
// that support is under active development (the API would 422) and
// never changes the selection. Do not fake functionality.

import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Construction } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiGet } from "../../api/client";
import type { RulesetInfo } from "../../api/types";
import { rulesetTone } from "../RulesetBadge";

interface Props {
  value: string;
  onChange: (rulesetId: string) => void;
}

export function RulesetSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [devNote, setDevNote] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const rulesets = useQuery({
    queryKey: ["rulesets"],
    queryFn: () => apiGet<RulesetInfo[]>("/rulesets"),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const entries = rulesets.data ?? [];
  const available = entries.filter((r) => r.status === "available");
  const inDevelopment = entries.filter((r) => r.status === "in_development");
  const roadmap = entries.filter((r) => r.status === "roadmap");
  const selected = entries.find((r) => r.id === value);

  return (
    <div ref={rootRef} className="relative">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
        Ruleset
      </div>

      {/* trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`mt-1.5 flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left transition-colors ${
          open ? "border-blue-600 ring-1 ring-blue-600" : "border-stone-300 hover:border-stone-500"
        }`}
      >
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            {selected && (
              <span
                aria-hidden
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${rulesetTone(selected.id, selected.status).dot}`}
              />
            )}
            <span className="truncate text-xs font-semibold text-stone-800">
              {selected ? selected.authority : "Select a ruleset"}
            </span>
            {selected && <StatusBadge status={selected.status} />}
          </span>
          {selected && (
            <span className="block truncate text-[11px] text-stone-500">
              {selected.name}
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden
          className={`h-3.5 w-3.5 shrink-0 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* popover listbox */}
      {open && (
        <div
          role="listbox"
          aria-label="Ruleset"
          className="absolute left-0 right-0 z-30 mt-1 max-h-96 overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-lg shadow-stone-900/5"
        >
          <GroupLabel>Available</GroupLabel>
          {available.map((r) => (
            <Option
              key={r.id}
              ruleset={r}
              selected={r.id === value}
              onSelect={() => {
                onChange(r.id);
                setDevNote(null);
                setOpen(false);
              }}
            />
          ))}
          {inDevelopment.length > 0 && (
            <>
              <GroupLabel>In Development</GroupLabel>
              {inDevelopment.map((r) => (
                <Option
                  key={r.id}
                  ruleset={r}
                  selected={false}
                  onSelect={() =>
                    // never becomes the selection — support is in development
                    setDevNote(
                      `${r.authority} (${r.jurisdiction}) support is under active development — reviews cannot run against this ruleset yet.`,
                    )
                  }
                />
              ))}
            </>
          )}
          {roadmap.length > 0 && (
            <>
              <GroupLabel>Roadmap</GroupLabel>
              <div className="px-3 py-2 text-[11px] leading-5 text-stone-400">
                {roadmap.map((r) => r.authority).join(" · ")}
              </div>
            </>
          )}
        </div>
      )}

      {selected?.status === "available" && !devNote && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-stone-400">
          <span>{selected.jurisdiction}</span>
          {selected.version && <span>· {selected.version}</span>}
          {selected.rule_count != null && <span>· {selected.rule_count} rules</span>}
        </div>
      )}
      {devNote && (
        <p className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-4 text-amber-800">
          <Construction aria-hidden className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{devNote}</span>
        </p>
      )}
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-stone-100 bg-stone-50/60 px-3 py-1 text-[9px] font-semibold uppercase tracking-widest text-stone-400 first:border-t-0">
      {children}
    </div>
  );
}

function Option({
  ruleset,
  selected,
  onSelect,
}: {
  ruleset: RulesetInfo;
  selected: boolean;
  onSelect: () => void;
}) {
  const inDevelopment = ruleset.status === "in_development";
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-disabled={inDevelopment}
      onClick={onSelect}
      className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-stone-50 ${
        selected ? "bg-stone-50" : ""
      } ${inDevelopment ? "opacity-75" : ""}`}
    >
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${rulesetTone(ruleset.id, ruleset.status).dot}`}
          />
          <span
            className={`truncate text-xs font-semibold ${inDevelopment ? "text-stone-600" : "text-stone-800"}`}
          >
            {ruleset.authority}
          </span>
          <StatusBadge status={ruleset.status} />
        </span>
        <span className="block truncate text-[11px] text-stone-500">
          {ruleset.name}
        </span>
        <span className="block text-[10px] text-stone-400">
          {ruleset.jurisdiction}
          {ruleset.version && ` · ${ruleset.version}`}
          {ruleset.rule_count != null && ` · ${ruleset.rule_count} rules`}
        </span>
      </span>
      {selected && (
        <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
      )}
    </button>
  );
}

function StatusBadge({ status }: { status: RulesetInfo["status"] }) {
  if (status === "available") {
    return (
      <span className="shrink-0 rounded-full bg-green-50 px-1.5 py-0.5 text-[9px] font-medium text-green-600">
        Available
      </span>
    );
  }
  if (status === "in_development") {
    return (
      <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
        In Development
      </span>
    );
  }
  return null;
}
