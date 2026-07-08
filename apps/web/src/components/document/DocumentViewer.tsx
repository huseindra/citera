import { useEffect, useMemo, useRef } from "react";
import type { FindingOut } from "../../api/types";
import { segment } from "../../lib/segment";
import { STATUS_META } from "../../lib/status";

interface Props {
  text: string;
  findings: FindingOut[];
  selectedId: string | null;
  onSelect: (findingId: string) => void;
}

export function DocumentViewer({ text, findings, selectedId, onSelect }: Props) {
  const segments = useMemo(() => segment(text, findings), [text, findings]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedId || !containerRef.current) return;
    const mark = containerRef.current.querySelector(
      `[data-finding-ids~="${selectedId}"]`,
    );
    mark?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedId]);

  const selected = findings.find((f) => f.id === selectedId);
  const spanless =
    selected && !selected.span
      ? selected.status === "not_found"
        ? "This element was not found in the document — see the searched queries in the matrix (evidence of absence)."
        : "This finding carries no document span."
      : null;

  return (
    <div ref={containerRef} className="h-full overflow-y-auto bg-white">
      {spanless && (
        <div className="sticky top-0 border-b border-violet-200 bg-violet-50 px-6 py-2 text-xs text-violet-700">
          {spanless}
        </div>
      )}
      <div className="mx-auto max-w-3xl px-8 py-8 font-serif text-[15px] leading-7 text-stone-800 whitespace-pre-wrap">
        {segments.map((seg, i) => {
          if (seg.findingIds.length === 0 || seg.status === null) {
            return <span key={i}>{seg.text}</span>;
          }
          const isSelected = selectedId !== null && seg.findingIds.includes(selectedId);
          return (
            <mark
              key={i}
              data-finding-ids={seg.findingIds.join(" ")}
              data-selected={isSelected || undefined}
              onClick={() => onSelect(seg.findingIds[0])}
              title={`Evidence for ${seg.findingIds.length} finding(s) — click to inspect`}
              className={`cursor-pointer rounded-sm px-0.5 transition-shadow ${STATUS_META[seg.status].mark} ${
                isSelected ? "evidence-pulse ring-2 ring-stone-400" : ""
              }`}
            >
              {seg.text}
            </mark>
          );
        })}
      </div>
    </div>
  );
}
