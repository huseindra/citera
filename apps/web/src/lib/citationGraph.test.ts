import { describe, expect, it } from "vitest";
import type { FindingEvidenceOut, FindingOut } from "../api/types";
import { buildCitationGraph } from "./citationGraph";

function finding(overrides: Partial<FindingOut>): FindingOut {
  return {
    id: "f1",
    rule_id: "fda-50.25-a2-risks",
    rule_title: "Risks",
    citation: "21 CFR 50.25(a)(2)",
    severity: "critical",
    status: "satisfied",
    reasoning: "",
    verbatim_quote: "quote",
    span: { page: null, char_start: 100, char_end: 200 },
    evidence_strength: "strong",
    protocol_reference: null,
    queries_executed: null,
    suggested_revision: null,
    source: "engine" as const,
    reviewer_name: null,
    created_at: "",
    ...overrides,
  };
}

const evidence: FindingEvidenceOut = {
  finding_id: "f1",
  queries_executed: ["q1", "q2"],
  fusion_params: { k: 60 },
  embedding_model: "fake-bow@1",
  results: [
    {
      chunk_id: "c1",
      rank: 1,
      section_title: "Risks",
      char_start: 50,
      char_end: 400,
      text_preview: "…",
      dense_score: 0.4,
      sparse_score: 0.1,
      fused_score: 0.05,
    },
    {
      chunk_id: "c2",
      rank: 2,
      section_title: "Benefits",
      char_start: 500,
      char_end: 900,
      text_preview: "…",
      dense_score: 0.3,
      sparse_score: null,
      fused_score: 0.03,
    },
  ],
};

describe("buildCitationGraph", () => {
  it("conflicting finding: regulation → protocol → chunks → finding", () => {
    const g = buildCitationGraph(
      finding({ status: "conflicting", protocol_reference: "Protocol §6 says…" }),
      evidence,
    );
    const kinds = g.nodes.map((n) => n.kind);
    expect(kinds).toContain("protocol");
    expect(kinds.filter((k) => k === "chunk")).toHaveLength(2);
    // protocol sits between regulation and chunks
    expect(g.edges).toContainEqual(
      expect.objectContaining({ source: "regulation", target: "protocol" }),
    );
    expect(g.edges).toContainEqual(
      expect.objectContaining({ source: "protocol", target: "chunk-c1" }),
    );
    expect(g.edges).toContainEqual(
      expect.objectContaining({ source: "chunk-c1", target: "finding" }),
    );
  });

  it("satisfied finding without protocol reference skips the protocol node", () => {
    const g = buildCitationGraph(finding({}), evidence);
    expect(g.nodes.every((n) => n.kind !== "protocol")).toBe(true);
    expect(g.edges).toContainEqual(
      expect.objectContaining({ source: "regulation", target: "chunk-c1" }),
    );
  });

  it("marks the grounded chunk (span inside chunk range) with emphasis", () => {
    const g = buildCitationGraph(finding({}), evidence);
    const c1 = g.nodes.find((n) => n.id === "chunk-c1");
    const c2 = g.nodes.find((n) => n.id === "chunk-c2");
    expect(c1?.emphasis).toBe(true); // span 100 within 50–400
    expect(c2?.emphasis).toBe(false);
  });

  it("not_found: regulation → queries → no-match → finding, no chunks", () => {
    const g = buildCitationGraph(
      finding({
        status: "not_found",
        span: null,
        verbatim_quote: null,
        queries_executed: ["voluntary participation", "right to withdraw"],
      }),
      evidence,
    );
    expect(g.nodes.map((n) => n.kind)).toEqual([
      "regulation",
      "queries",
      "no_match",
      "finding",
    ]);
    const queries = g.nodes.find((n) => n.kind === "queries");
    expect(queries?.label).toBe("2 queries executed");
  });

  it("chunk nodes carry offsets for span navigation", () => {
    const g = buildCitationGraph(finding({}), evidence);
    expect(g.nodes.find((n) => n.id === "chunk-c1")?.offset).toBe(50);
    expect(g.nodes.find((n) => n.kind === "finding")?.offset).toBe(100);
  });

  it("survives missing evidence (drawer opened before fetch resolves)", () => {
    const g = buildCitationGraph(finding({}), null);
    expect(g.nodes.map((n) => n.kind)).toEqual(["regulation", "finding"]);
  });
});
