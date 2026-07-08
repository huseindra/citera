import {
  Background,
  Handle,
  Position,
  ReactFlow,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import type { FindingEvidenceOut, FindingOut } from "../../api/types";
import {
  buildCitationGraph,
  type GraphNode,
  type NodeKind,
} from "../../lib/citationGraph";

const KIND_STYLES: Record<NodeKind, string> = {
  regulation: "border-stone-400 bg-white",
  protocol: "border-sky-300 bg-sky-50",
  chunk: "border-stone-300 bg-stone-50",
  queries: "border-violet-300 bg-violet-50",
  no_match: "border-violet-300 bg-white border-dashed",
  finding: "border-stone-800 bg-stone-900 text-white",
};

type CitationNode = Node<{ graphNode: GraphNode }>;

function CitationNodeView({ data }: NodeProps<CitationNode>) {
  const { graphNode } = data;
  return (
    <div
      className={`max-w-52 rounded-lg border px-3 py-2 text-xs shadow-sm ${
        KIND_STYLES[graphNode.kind]
      } ${graphNode.emphasis ? "ring-2 ring-amber-400" : ""} ${
        graphNode.offset !== undefined ? "cursor-pointer" : ""
      }`}
      title={
        graphNode.offset !== undefined
          ? "Click to locate in the document"
          : undefined
      }
    >
      <Handle type="target" position={Position.Left} className="!bg-stone-300" />
      <div className="font-medium">{graphNode.label}</div>
      {graphNode.sublabel && (
        <div
          className={`mt-0.5 text-[10px] ${
            graphNode.kind === "finding" ? "text-stone-300" : "text-stone-500"
          }`}
        >
          {graphNode.sublabel}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-stone-300" />
    </div>
  );
}

const nodeTypes = { citation: CitationNodeView };

// static 4-column layout: regulation | protocol/queries | chunks | finding
const COLUMN_X: Record<NodeKind, number> = {
  regulation: 0,
  protocol: 240,
  queries: 240,
  chunk: 480,
  no_match: 480,
  finding: 720,
};

export function CitationGraphView({
  finding,
  evidence,
  onScrollToOffset,
}: {
  finding: FindingOut;
  evidence: FindingEvidenceOut | null;
  onScrollToOffset: (offset: number) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    const graph = buildCitationGraph(finding, evidence);
    const perColumn: Record<number, number> = {};
    const nodes: CitationNode[] = graph.nodes.map((n) => {
      const x = COLUMN_X[n.kind];
      const row = perColumn[x] ?? 0;
      perColumn[x] = row + 1;
      return {
        id: n.id,
        type: "citation",
        position: { x, y: 40 + row * 90 },
        data: { graphNode: n },
      };
    });
    const edges = graph.edges.map((e) => ({
      ...e,
      animated: false,
      style: { stroke: "#d6d3d1" },
    }));
    return { nodes, edges };
  }, [finding, evidence]);

  return (
    <div className="min-h-0 flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={(_, node) => {
          const offset = (node as CitationNode).data.graphNode.offset;
          if (offset !== undefined) onScrollToOffset(offset);
        }}
      >
        <Background gap={16} color="#f5f5f4" />
      </ReactFlow>
    </div>
  );
}
