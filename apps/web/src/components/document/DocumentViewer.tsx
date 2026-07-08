import { useEffect, useMemo, useRef } from "react";
import type { FindingOut } from "../../api/types";
import { segment } from "../../lib/segment";
import { STATUS_META } from "../../lib/status";

interface Props {
  text: string;
  findings: FindingOut[];
  selectedId: string | null;
  onSelect: (findingId: string) => void;
  /** canonical-text offset to scroll to (citation graph / audit table) */
  scrollOffset?: { offset: number; nonce: number } | null;
}

export function DocumentViewer({
  text,
  findings,
  selectedId,
  onSelect,
  scrollOffset,
}: Props) {
  const segments = useMemo(() => segment(text, findings), [text, findings]);
  const containerRef = useRef<HTMLDivElement>(null);

  // segment start offsets, parallel to `segments`
  const starts = useMemo(() => {
    const acc: number[] = [];
    let cursor = 0;
    for (const seg of segments) {
      acc.push(cursor);
      cursor += seg.text.length;
    }
    return acc;
  }, [segments]);

  useEffect(() => {
    if (!selectedId || !containerRef.current) return;
    const mark = containerRef.current.querySelector(
      `[data-finding-ids~="${selectedId}"]`,
    );
    mark?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedId]);

  useEffect(() => {
    if (!scrollOffset || !containerRef.current) return;
    const elements =
      containerRef.current.querySelectorAll<HTMLElement>("[data-start]");
    let target: HTMLElement | null = null;
    for (const el of elements) {
      if (Number(el.dataset.start) <= scrollOffset.offset) target = el;
      else break;
    }
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [scrollOffset]);

  const selected = findings.find((f) => f.id === selectedId);
  const spanless =
    selected && !selected.span
      ? selected.status === "not_found"
        ? "This element was not found in the document — see the searched queries in the evidence panel (evidence of absence)."
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
            return (
              <span key={i} data-start={starts[i]}>
                {seg.text}
              </span>
            );
          }
          const isSelected = selectedId !== null && seg.findingIds.includes(selectedId);
          return (
            <mark
              key={i}
              data-start={starts[i]}
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
