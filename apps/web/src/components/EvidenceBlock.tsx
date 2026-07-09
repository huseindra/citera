// The Evidence Block — Citera's visual identity. One consistent shape
// everywhere evidence appears: soft accent border, light surface, the
// quoted text, its source references, and an honest verification status.
// Verified means the quote passed the span-grounding gate; a quote that
// was never grounded (e.g. a protocol reference cited by the analysis)
// simply shows no verification claim.

import { BadgeCheck } from "lucide-react";
import { stripMarkdownMarkers } from "../lib/format";

interface Props {
  label?: string;
  quote: string;
  source: string;
  page?: number | null;
  section?: string | null;
  chars?: { start: number; end: number } | null;
  /** true → "Verified" (grounded); undefined → no claim shown */
  verified?: boolean;
  accent?: "evidence" | "conflict";
  onClick?: () => void;
}

export function EvidenceBlock({
  label = "Evidence",
  quote,
  source,
  page,
  section,
  chars,
  verified,
  accent = "evidence",
  onClick,
}: Props) {
  const accentClass =
    accent === "conflict"
      ? "border-red-200 border-l-red-400 bg-red-50/40"
      : "border-sky-100 border-l-sky-500 bg-sky-50/50";

  return (
    <figure
      onClick={onClick}
      title={onClick ? "Click to locate in the document" : undefined}
      className={`rounded-lg border border-l-4 px-3 py-2.5 ${accentClass} ${
        onClick ? "cursor-pointer transition-colors hover:bg-sky-50" : ""
      }`}
    >
      <figcaption className="text-[10px] font-medium uppercase tracking-wide text-stone-500">
        {label}
      </figcaption>
      <blockquote className="mt-1 text-sm leading-6 text-stone-900">
        “{stripMarkdownMarkers(quote)}”
      </blockquote>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-500">
        <span className="font-medium text-stone-500">{source}</span>
        {page != null && <span>Page {page}</span>}
        {section && <span>Section {section}</span>}
        {chars && (
          <span className="font-mono text-[10px] text-stone-400">
            chars {chars.start}–{chars.end}
          </span>
        )}
        {verified && (
          <span className="inline-flex items-center gap-1 font-medium text-green-600">
            <BadgeCheck aria-hidden className="h-3.5 w-3.5" /> Verified
          </span>
        )}
      </div>
    </figure>
  );
}
