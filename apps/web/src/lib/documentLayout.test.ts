import { describe, expect, it } from "vitest";
import type { FindingOut } from "../api/types";
import { layoutDocument } from "./documentLayout";

function finding(id: string, start: number, end: number): FindingOut {
  return {
    id,
    rule_id: id,
    rule_title: null,
    citation: null,
    severity: null,
    status: "conflicting",
    reasoning: "",
    verbatim_quote: null,
    span: { page: null, char_start: start, char_end: end },
    evidence_strength: null,
    protocol_reference: null,
    queries_executed: null,
  suggested_revision: null,
    created_at: "",
  };
}

const TEXT = "## Risks\n\nDrug is **well tolerated** here.\n\n---\n\n- bullet item\nplain line\n";

describe("layoutDocument", () => {
  it("preserves every character: line slices + single-newline separators", () => {
    const lines = layoutDocument(TEXT, [finding("f", 10, 30)]);
    let covered = 0;
    for (let i = 0; i < lines.length; i++) {
      const joined = lines[i].segments.map((s) => s.text).join("");
      expect(TEXT.slice(lines[i].start, lines[i].start + joined.length)).toBe(joined);
      const next = lines[i + 1];
      if (next) {
        // exactly one newline between consecutive lines — nothing swallowed
        expect(next.start).toBe(lines[i].start + joined.length + 1);
        expect(TEXT[lines[i].start + joined.length]).toBe("\n");
      }
      covered = lines[i].start + joined.length;
    }
    // everything up to the trailing newline is accounted for
    expect(covered).toBe(TEXT.endsWith("\n") ? TEXT.length - 1 : TEXT.length);
  });

  it("classifies structure without altering text", () => {
    const lines = layoutDocument(TEXT, []);
    expect(lines[0]).toMatchObject({ kind: "h2", markerLen: 3, start: 0 });
    expect(lines[0].segments[0].text).toBe("## Risks"); // marker kept
    expect(lines.find((l) => l.kind === "hr")).toBeTruthy();
    expect(lines.find((l) => l.kind === "bullet")).toBeTruthy();
    expect(lines.filter((l) => l.kind === "blank").length).toBeGreaterThan(0);
  });

  it("marks segments within a line at exact offsets", () => {
    const start = TEXT.indexOf("**well tolerated**");
    const end = start + "**well tolerated**".length;
    const lines = layoutDocument(TEXT, [finding("f1", start, end)]);
    const drugLine = lines.find((l) =>
      l.segments.some((s) => s.findingIds.includes("f1")),
    )!;
    const marked = drugLine.segments.find((s) => s.findingIds.includes("f1"))!;
    expect(marked.text).toBe("**well tolerated**");
    expect(marked.status).toBe("conflicting");
    // neighbors unmarked
    expect(drugLine.segments[0].findingIds).toEqual([]);
  });

  it("a span crossing multiple lines marks each line's slice", () => {
    const start = TEXT.indexOf("Drug is");
    const end = TEXT.indexOf("bullet item") + 6;
    const lines = layoutDocument(TEXT, [finding("wide", start, end)]);
    const markedLines = lines.filter((l) =>
      l.segments.some((s) => s.findingIds.includes("wide")),
    );
    expect(markedLines.length).toBeGreaterThan(1);
    for (const line of markedLines) {
      const joined = line.segments.map((s) => s.text).join("");
      expect(TEXT.slice(line.start, line.start + joined.length)).toBe(joined);
    }
  });

  it("line starts index into the canonical text", () => {
    const lines = layoutDocument(TEXT, []);
    for (const line of lines) {
      const joined = line.segments.map((s) => s.text).join("");
      expect(TEXT.slice(line.start, line.start + joined.length)).toBe(joined);
    }
  });
});
