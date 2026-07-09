import { useQuery } from "@tanstack/react-query";
import { X as XIcon } from "lucide-react";
import { apiGet } from "../../api/client";
import type { FindingOut, SemanticMapOut } from "../../api/types";
import { classifyPoint } from "../../lib/semanticMap";

// SVG fill per status — parallel to STATUS_META colors (tailwind classes
// don't reach SVG fills without config, so explicit hex here).
const FILL: Record<string, string> = {
  conflicting: "#dc2626",
  partial: "#d97706",
  satisfied: "#10b981",
  evaluation_failed: "#a8a29e",
};

const SIZE = 280;
const PAD = 16;

interface Props {
  documentId: string;
  findings: FindingOut[];
  selectedId: string | null;
  onScrollToOffset: (offset: number) => void;
  onClose: () => void;
}

export function SemanticMap({
  documentId,
  findings,
  selectedId,
  onScrollToOffset,
  onClose,
}: Props) {
  const map = useQuery({
    queryKey: ["semantic-map", documentId],
    queryFn: () => apiGet<SemanticMapOut>(`/documents/${documentId}/semantic-map`),
  });

  const points = map.data?.points ?? [];
  if (map.isSuccess && points.length === 0) return null;

  return (
    <div className="absolute right-4 top-4 z-10 rounded-xl border border-stone-200 bg-white/95 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between px-3 py-2">
        <div>
          <div className="text-xs font-semibold text-stone-700">
            Semantic evidence map
          </div>
          <div className="text-[10px] text-stone-400">
            chunk embeddings, PCA — colored = carries evidence
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close semantic map"
          className="rounded-md px-2 py-1 text-stone-400 hover:bg-stone-100"
        >
          <XIcon aria-hidden className="h-3.5 w-3.5" />
        </button>
      </div>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="Scatter plot of document chunks in semantic space"
        className="block"
      >
        {points.map((p) => {
          const { status, findingId } = classifyPoint(p, findings);
          const isSelected = findingId !== null && findingId === selectedId;
          const cx = PAD + p.x * (SIZE - 2 * PAD);
          const cy = PAD + (1 - p.y) * (SIZE - 2 * PAD);
          return (
            <circle
              key={p.chunk_id}
              cx={cx}
              cy={cy}
              r={isSelected ? 8 : status ? 6 : 4}
              fill={status ? FILL[status] : "#e7e5e4"}
              stroke={isSelected ? "#292524" : status ? "#ffffff" : "none"}
              strokeWidth={isSelected ? 2 : 1}
              className="cursor-pointer transition-all"
              onClick={() => onScrollToOffset(p.char_start)}
            >
              <title>
                {(p.section_title ?? "…") + "\n" + p.preview + "…"}
              </title>
            </circle>
          );
        })}
      </svg>
      <div className="flex items-center gap-3 px-3 pb-2 text-[10px] text-stone-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-stone-200" /> no evidence
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-500" /> satisfied
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-600" /> partial
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-600" /> conflicting
        </span>
      </div>
    </div>
  );
}
