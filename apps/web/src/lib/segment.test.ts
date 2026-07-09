import { describe, expect, it } from "vitest";
import type { FindingOut } from "../api/types";
import { segment } from "./segment";

function finding(
  id: string,
  start: number | null,
  end: number | null,
  status: FindingOut["status"] = "satisfied",
): FindingOut {
  return {
    id,
    rule_id: `rule-${id}`,
    rule_title: null,
    citation: null,
    severity: null,
    status,
    reasoning: "",
    verbatim_quote: null,
    span: start === null ? null : { page: null, char_start: start, char_end: end! },
    evidence_strength: null,
    protocol_reference: null,
    queries_executed: null,
  suggested_revision: null,
    created_at: "",
  };
}

const TEXT = "0123456789abcdefghij"; // 20 chars, offsets are self-describing

describe("segment", () => {
  it("reassembles to the exact original text (round-trip invariant)", () => {
    const segments = segment(TEXT, [
      finding("a", 2, 6),
      finding("b", 10, 15, "conflicting"),
    ]);
    expect(segments.map((s) => s.text).join("")).toBe(TEXT);
  });

  it("marks the right slices", () => {
    const segments = segment(TEXT, [finding("a", 5, 10, "partial")]);
    expect(segments).toHaveLength(3);
    expect(segments[1]).toMatchObject({
      text: "56789",
      findingIds: ["a"],
      status: "partial",
    });
    expect(segments[0].findingIds).toEqual([]);
    expect(segments[2].findingIds).toEqual([]);
  });

  it("overlapping spans stack ids and the strongest status wins", () => {
    const segments = segment(TEXT, [
      finding("sat", 0, 10, "satisfied"),
      finding("conf", 5, 15, "conflicting"),
    ]);
    const overlap = segments.find((s) => s.findingIds.length === 2);
    expect(overlap).toMatchObject({ text: "56789", status: "conflicting" });
    expect(overlap!.findingIds).toContain("sat");
    expect(overlap!.findingIds).toContain("conf");
  });

  it("adjacent spans do not merge", () => {
    const segments = segment(TEXT, [finding("a", 0, 5), finding("b", 5, 10)]);
    expect(segments[0]).toMatchObject({ text: "01234", findingIds: ["a"] });
    expect(segments[1]).toMatchObject({ text: "56789", findingIds: ["b"] });
  });

  it("spans at text boundaries work", () => {
    const segments = segment(TEXT, [finding("a", 0, 20)]);
    expect(segments).toHaveLength(1);
    expect(segments[0].findingIds).toEqual(["a"]);
  });

  it("findings without spans (not_found) are ignored", () => {
    const segments = segment(TEXT, [finding("nf", null, null, "not_found")]);
    expect(segments).toHaveLength(1);
    expect(segments[0].findingIds).toEqual([]);
  });

  it("out-of-range spans are dropped, not rendered wrongly", () => {
    const segments = segment(TEXT, [finding("bad", 5, 999)]);
    expect(segments.map((s) => s.text).join("")).toBe(TEXT);
    expect(segments.every((s) => s.findingIds.length === 0)).toBe(true);
  });

  it("empty text yields no segments", () => {
    expect(segment("", [])).toEqual([]);
  });
});
