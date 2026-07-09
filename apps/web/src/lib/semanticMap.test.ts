import { describe, expect, it } from "vitest";
import type { FindingOut, SemanticPoint } from "../api/types";
import { classifyPoint } from "./semanticMap";

function point(start: number, end: number): SemanticPoint {
  return {
    chunk_id: "c1",
    x: 0.5,
    y: 0.5,
    section_title: "Risks",
    char_start: start,
    char_end: end,
    preview: "",
  };
}

function finding(
  id: string,
  spanStart: number | null,
  status: FindingOut["status"] = "satisfied",
): FindingOut {
  return {
    id,
    rule_id: id,
    rule_title: null,
    citation: null,
    severity: null,
    status,
    reasoning: "",
    verbatim_quote: null,
    span:
      spanStart === null
        ? null
        : { page: null, char_start: spanStart, char_end: spanStart + 50 },
    evidence_strength: null,
    protocol_reference: null,
    queries_executed: null,
  suggested_revision: null,
    created_at: "",
  };
}

describe("classifyPoint", () => {
  it("chunk containing a finding's span start is evidence", () => {
    const result = classifyPoint(point(100, 400), [
      finding("f1", 150, "conflicting"),
    ]);
    expect(result).toEqual({ status: "conflicting", findingId: "f1" });
  });

  it("chunk without any span start is plain", () => {
    expect(classifyPoint(point(100, 400), [finding("f1", 500)])).toEqual({
      status: null,
      findingId: null,
    });
  });

  it("span start at chunk end boundary is exclusive", () => {
    expect(classifyPoint(point(100, 400), [finding("f1", 400)]).status).toBeNull();
  });

  it("not_found findings (no span) never color a chunk", () => {
    expect(
      classifyPoint(point(0, 100), [finding("nf", null, "not_found")]).status,
    ).toBeNull();
  });

  it("overlapping findings resolve to the strongest status", () => {
    const result = classifyPoint(point(0, 500), [
      finding("sat", 10, "satisfied"),
      finding("conf", 20, "conflicting"),
    ]);
    expect(result).toEqual({ status: "conflicting", findingId: "conf" });
  });
});
