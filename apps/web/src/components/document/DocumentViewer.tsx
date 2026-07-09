import { useEffect, useMemo, useRef } from "react";
import type { FindingOut } from "../../api/types";
import { layoutDocument, type DocLine } from "../../lib/documentLayout";
import { STATUS_META } from "../../lib/status";
import { Minimap } from "./Minimap";

interface Props {
  text: string;
  findings: FindingOut[];
  selectedId: string | null;
  onSelect: (findingId: string) => void;
  scrollOffset?: { offset: number; nonce: number } | null;
}

const LINE_STYLES: Record<DocLine["kind"], string> = {
  h1: "mt-8 mb-2 font-sans text-xl font-semibold tracking-tight text-stone-900",
  h2: "mt-7 mb-1.5 font-sans text-base font-semibold tracking-tight text-stone-900",
  h3: "mt-5 mb-1 font-sans text-sm font-semibold text-stone-800",
  hr: "my-5 border-t border-stone-200 leading-none",
  bullet: "pl-5 leading-7",
  blank: "h-3",
  text: "leading-7",
}

export function DocumentViewer({
  text,
  findings,
  selectedId,
  onSelect,
  scrollOffset,
}: Props) {
  const lines = useMemo(() => layoutDocument(text, findings), [text, findings]);
  const containerRef = useRef<HTMLDivElement>(null);

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
        ? "This element was not found in the document — the evidence panel shows what was searched (evidence of absence)."
        : "This finding carries no document span."
      : null;

  return (
    <div className="relative h-full">
      <div ref={containerRef} className="h-full overflow-y-auto bg-white pr-4">
        {spanless && (
          <div className="sticky top-0 z-10 border-b border-sky-200 bg-sky-50 px-6 py-2 text-xs text-sky-700">
            {spanless}
          </div>
        )}
        <div className="mx-auto max-w-2xl px-10 py-10 font-serif text-[15px] text-stone-800">
          {lines.map((line) => (
            <div
              key={line.start}
              data-start={line.start}
              className={LINE_STYLES[line.kind]}
            >
              {renderLine(line, selectedId, onSelect)}
            </div>
          ))}
        </div>
      </div>
      <Minimap
        totalLength={text.length}
        findings={findings}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </div>
  );
}

function renderLine(
  line: DocLine,
  selectedId: string | null,
  onSelect: (id: string) => void,
) {
  if (line.kind === "blank") return null;
  let markerBudget = line.markerLen;
  // emphasis state survives across highlight-segment boundaries in a line
  const emphasis = { bold: false, italic: false };

  return line.segments.map((seg, i) => {
    // hide leading structural markers ("## ") without removing characters:
    // they stay in the DOM so canonical offsets are preserved
    let marker: string | null = null;
    let rest = seg.text;
    if (markerBudget > 0) {
      marker = seg.text.slice(0, markerBudget);
      rest = seg.text.slice(markerBudget);
      markerBudget -= marker.length;
    }
    if (line.kind === "hr") {
      return (
        <span key={i} className="hidden">
          {seg.text}
        </span>
      );
    }

    const content = (
      <>
        {marker && <span className="hidden">{marker}</span>}
        {renderInline(rest, emphasis)}
      </>
    );

    if (seg.findingIds.length === 0 || seg.status === null) {
      return <span key={i}>{content}</span>;
    }
    const isSelected = selectedId !== null && seg.findingIds.includes(selectedId);
    return (
      <mark
        key={i}
        data-finding-ids={seg.findingIds.join(" ")}
        onClick={() => onSelect(seg.findingIds[0])}
        title="Evidence — click to inspect"
        className={`cursor-pointer rounded-sm px-0.5 transition-shadow ${STATUS_META[seg.status].mark} ${
          isSelected ? "evidence-pulse ring-2 ring-stone-400" : ""
        }`}
      >
        {content}
      </mark>
    );
  });
}

/** Inline markdown emphasis, offset-preserving: `**`/`*` tokens stay in
 *  the DOM (hidden), the text between them is styled. The reader sees a
 *  clean document; the evidence-span contract sees every character. */
function renderInline(
  text: string,
  emphasis: { bold: boolean; italic: boolean },
) {
  const parts = text.split(/(\*\*|\*)/);
  return parts.map((part, j) => {
    if (part === "**") {
      emphasis.bold = !emphasis.bold;
      return (
        <span key={j} className="hidden">
          {part}
        </span>
      );
    }
    if (part === "*") {
      emphasis.italic = !emphasis.italic;
      return (
        <span key={j} className="hidden">
          {part}
        </span>
      );
    }
    if (!part) return null;
    if (!emphasis.bold && !emphasis.italic) return <span key={j}>{part}</span>;
    return (
      <span
        key={j}
        className={`${emphasis.bold ? "font-semibold" : ""} ${
          emphasis.italic ? "italic" : ""
        }`.trim()}
      >
        {part}
      </span>
    );
  });
}
