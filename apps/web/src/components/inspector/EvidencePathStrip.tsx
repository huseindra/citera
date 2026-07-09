// The animated Evidence Path: a compact horizontal walk of the citation
// DAG (Regulation → Protocol → Evidence → Finding). Nodes stagger in when
// the finding changes — the "watch the reasoning path light up" moment.
// Expand opens the full React Flow graph in a modal.

import { ArrowRight, Maximize2 } from "lucide-react";
import { useState } from "react";
import type { FindingEvidenceOut, FindingOut } from "../../api/types";
import { buildCitationGraph, type NodeKind } from "../../lib/citationGraph";
import { GraphModal } from "./GraphModal";

const NODE_STYLE: Record<NodeKind, string> = {
  regulation: "border-stone-400 bg-white text-stone-700",
  protocol: "border-sky-300 bg-sky-50 text-sky-800",
  chunk: "border-stone-300 bg-stone-50 text-stone-600",
  queries: "border-violet-300 bg-violet-50 text-violet-800",
  no_match: "border-violet-300 border-dashed bg-white text-violet-700",
  finding: "border-stone-800 bg-stone-900 text-white",
};

const KIND_LABEL: Record<NodeKind, string> = {
  regulation: "Regulation",
  protocol: "Protocol",
  chunk: "Evidence",
  queries: "Queries",
  no_match: "No match",
  finding: "Finding",
};

export function EvidencePathStrip({
  finding,
  evidence,
  onScrollToOffset,
}: {
  finding: FindingOut;
  evidence: FindingEvidenceOut | null;
  onScrollToOffset: (offset: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const graph = buildCitationGraph(finding, evidence);

  // linearize: one representative node per column, chunks collapse to the
  // grounded one (or the top-ranked)
  const chunks = graph.nodes.filter((n) => n.kind === "chunk");
  const path = graph.nodes.filter((n) => n.kind !== "chunk");
  const chunkNode = chunks.find((n) => n.emphasis) ?? chunks[0];
  if (chunkNode) {
    const findingIndex = path.findIndex((n) => n.kind === "finding");
    path.splice(findingIndex, 0, chunkNode);
  }

  return (
    <section aria-label="Evidence path">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
          Evidence path
        </span>
        <button
          onClick={() => setExpanded(true)}
          className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-stone-400 hover:bg-stone-100 hover:text-stone-600"
        >
          <span className="inline-flex items-center gap-1">Expand graph <Maximize2 aria-hidden className="h-3 w-3" /></span>
        </button>
      </div>
      {/* key on finding id restarts the stagger animation per selection */}
      <ol key={finding.id} className="flex items-stretch gap-0">
        {path.map((node, i) => (
          <li key={node.id} className="flex min-w-0 flex-1 items-center">
            <button
              onClick={() =>
                node.offset !== undefined && onScrollToOffset(node.offset)
              }
              disabled={node.offset === undefined}
              title={node.sublabel ?? node.label}
              style={{ animationDelay: `${i * 140}ms` }}
              className={`path-node-in min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-left opacity-0 ${NODE_STYLE[node.kind]} ${
                node.offset !== undefined ? "cursor-pointer hover:shadow-sm" : "cursor-default"
              } ${node.emphasis ? "ring-2 ring-amber-400" : ""}`}
            >
              <div className="text-[9px] uppercase tracking-wide opacity-60">
                {KIND_LABEL[node.kind]}
              </div>
              <div className="truncate text-[11px] font-medium leading-4">
                {node.label}
              </div>
            </button>
            {i < path.length - 1 && (
              <span
                aria-hidden
                style={{ animationDelay: `${i * 140 + 70}ms` }}
                className="path-node-in px-0.5 text-stone-300 opacity-0"
              >
                <ArrowRight className="h-3 w-3" />
              </span>
            )}
          </li>
        ))}
      </ol>
      {expanded && (
        <GraphModal
          finding={finding}
          evidence={evidence}
          onScrollToOffset={(offset) => {
            setExpanded(false);
            onScrollToOffset(offset);
          }}
          onClose={() => setExpanded(false)}
        />
      )}
    </section>
  );
}
