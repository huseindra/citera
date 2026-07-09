// Pure assembly of the citation DAG for one finding:
//   Regulation → Protocol reference → Evidence chunks → Finding
// not_found:  Regulation → Queries → ∅ no-match → Finding
// Data comes from the finding + its recorded retrieval — no graph
// database, no server round-trip beyond the evidence endpoint.

import type { FindingEvidenceOut, FindingOut } from "../api/types";
import { STATUS_META } from "./status";

export type NodeKind =
  | "regulation"
  | "protocol"
  | "chunk"
  | "queries"
  | "no_match"
  | "finding";

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  sublabel?: string;
  /** canonical-text offset to scroll the document viewer to, if any */
  offset?: number;
  emphasis?: boolean; // e.g. the grounded chunk
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface CitationGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const MAX_CHUNKS = 3;

export function buildCitationGraph(
  finding: FindingOut,
  evidence: FindingEvidenceOut | null,
): CitationGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const link = (source: string, target: string) =>
    edges.push({ id: `${source}->${target}`, source, target });

  nodes.push({
    id: "regulation",
    kind: "regulation",
    label: finding.citation ?? finding.rule_id,
    sublabel: finding.rule_title ?? undefined,
  });

  const findingNode: GraphNode = {
    id: "finding",
    kind: "finding",
    label: STATUS_META[finding.status].label,
    sublabel: finding.evidence_strength
      ? `evidence: ${finding.evidence_strength}`
      : undefined,
    offset: finding.span?.char_start,
  };

  if (finding.status === "not_found") {
    const queries = finding.queries_executed ?? evidence?.queries_executed ?? [];
    nodes.push({
      id: "queries",
      kind: "queries",
      label: `${queries.length} queries executed`,
      sublabel: queries[0],
    });
    nodes.push({
      id: "no_match",
      kind: "no_match",
      label: "No relevant evidence",
      sublabel: "evidence of absence",
    });
    nodes.push(findingNode);
    link("regulation", "queries");
    link("queries", "no_match");
    link("no_match", "finding");
    return { nodes, edges };
  }

  let upstream = "regulation";
  if (finding.protocol_reference) {
    nodes.push({
      id: "protocol",
      kind: "protocol",
      label: "Study protocol",
      sublabel: finding.protocol_reference.slice(0, 80),
    });
    link("regulation", "protocol");
    upstream = "protocol";
  }

  const chunks = (evidence?.results ?? []).slice(0, MAX_CHUNKS);
  if (chunks.length === 0) {
    nodes.push(findingNode);
    link(upstream, "finding");
    return { nodes, edges };
  }

  const grounded = finding.span;
  for (const chunk of chunks) {
    const isGrounded =
      grounded !== null &&
      chunk.char_start !== null &&
      chunk.char_end !== null &&
      chunk.char_start <= grounded.char_start &&
      chunk.char_end >= grounded.char_start;
    const id = `chunk-${chunk.chunk_id}`;
    nodes.push({
      id,
      kind: "chunk",
      label: chunk.section_title ?? `chunk #${chunk.rank}`,
      sublabel: `rank ${chunk.rank} · fused ${chunk.fused_score.toFixed(4)}`,
      offset: chunk.char_start ?? undefined,
      emphasis: isGrounded,
    });
    link(upstream, id);
    link(id, "finding");
  }
  nodes.push(findingNode);
  return { nodes, edges };
}
