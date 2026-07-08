// The literal Evidence Heatmap: a vertical strip mapping the whole
// document, with a colored band at every evidence span. Click a band to
// jump to that finding.

import type { FindingOut } from "../../api/types";

const BAND_COLORS: Record<string, string> = {
  conflicting: "#dc2626",
  partial: "#d97706",
  satisfied: "#10b981",
  evaluation_failed: "#a8a29e",
};

interface Props {
  totalLength: number;
  findings: FindingOut[];
  selectedId: string | null;
  onSelect: (findingId: string) => void;
}

export function Minimap({ totalLength, findings, selectedId, onSelect }: Props) {
  const spanned = findings.filter((f) => f.span !== null);
  if (totalLength === 0 || spanned.length === 0) return null;

  return (
    <div
      aria-label="Evidence heatmap — document overview"
      role="navigation"
      className="absolute right-1 top-2 bottom-2 w-2.5 rounded-full bg-stone-100"
    >
      {spanned.map((f) => {
        const top = (f.span!.char_start / totalLength) * 100;
        const height = Math.max(
          0.8,
          ((f.span!.char_end - f.span!.char_start) / totalLength) * 100,
        );
        const isSelected = f.id === selectedId;
        return (
          <button
            key={f.id}
            title={`${f.rule_title ?? f.rule_id} — ${f.status}`}
            aria-label={`Jump to evidence: ${f.rule_title ?? f.rule_id}`}
            onClick={() => onSelect(f.id)}
            className="absolute left-0 w-full cursor-pointer rounded-full transition-transform hover:scale-x-150"
            style={{
              top: `${top}%`,
              height: `${height}%`,
              backgroundColor: BAND_COLORS[f.status] ?? "#a8a29e",
              outline: isSelected ? "2px solid #292524" : "none",
              outlineOffset: 1,
            }}
          />
        );
      })}
    </div>
  );
}
