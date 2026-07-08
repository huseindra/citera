// Line-aware document layout that PRESERVES the evidence-span contract:
// every character of the canonical text stays in the DOM at its original
// offset — structural markdown markers are dimmed by the renderer, never
// removed. Lines carry finding-mark segments computed per line.

import type { FindingOut, FindingStatus } from "../api/types";
import { STATUS_META } from "./status";

export type LineKind = "h1" | "h2" | "h3" | "hr" | "bullet" | "blank" | "text";

export interface LineSegment {
  text: string;
  findingIds: string[];
  status: FindingStatus | null;
}

export interface DocLine {
  /** canonical-text offset of the line's first character */
  start: number;
  kind: LineKind;
  /** number of leading marker characters to render dimmed (e.g. "## " = 3) */
  markerLen: number;
  segments: LineSegment[];
}

export function layoutDocument(text: string, findings: FindingOut[]): DocLine[] {
  const spanned = findings.filter(
    (f) =>
      f.span !== null &&
      f.span.char_start < f.span.char_end &&
      f.span.char_start >= 0 &&
      f.span.char_end <= text.length,
  );

  const lines: DocLine[] = [];
  let cursor = 0;
  while (cursor <= text.length) {
    const newline = text.indexOf("\n", cursor);
    const end = newline === -1 ? text.length : newline;
    const raw = text.slice(cursor, end);
    lines.push({
      start: cursor,
      ...classify(raw),
      segments: segmentLine(text, cursor, end, spanned),
    });
    if (newline === -1) break;
    cursor = newline + 1;
  }
  // drop a trailing phantom line produced by a final newline
  if (
    lines.length > 1 &&
    lines[lines.length - 1].segments.length === 0 &&
    text.endsWith("\n")
  ) {
    lines.pop();
  }
  return lines;
}

function classify(raw: string): { kind: LineKind; markerLen: number } {
  if (raw.trim() === "") return { kind: "blank", markerLen: 0 };
  const heading = raw.match(/^(#{1,3}) /);
  if (heading) {
    const level = heading[1].length;
    return {
      kind: level === 1 ? "h1" : level === 2 ? "h2" : "h3",
      markerLen: level + 1,
    };
  }
  if (/^-{3,}\s*$/.test(raw)) return { kind: "hr", markerLen: 0 };
  if (/^[-*] /.test(raw)) return { kind: "bullet", markerLen: 0 };
  return { kind: "text", markerLen: 0 };
}

function segmentLine(
  text: string,
  lineStart: number,
  lineEnd: number,
  spanned: FindingOut[],
): LineSegment[] {
  if (lineStart === lineEnd) return [];
  const overlapping = spanned.filter(
    (f) => f.span!.char_start < lineEnd && f.span!.char_end > lineStart,
  );
  if (overlapping.length === 0) {
    return [{ text: text.slice(lineStart, lineEnd), findingIds: [], status: null }];
  }

  const boundaries = new Set<number>([lineStart, lineEnd]);
  for (const f of overlapping) {
    boundaries.add(Math.max(lineStart, f.span!.char_start));
    boundaries.add(Math.min(lineEnd, f.span!.char_end));
  }
  const sorted = [...boundaries].sort((a, b) => a - b);

  const segments: LineSegment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start === end) continue;
    const covering = overlapping.filter(
      (f) => f.span!.char_start <= start && f.span!.char_end >= end,
    );
    segments.push({
      text: text.slice(start, end),
      findingIds: covering.map((f) => f.id),
      status: strongest(covering),
    });
  }
  return segments;
}

function strongest(findings: FindingOut[]): FindingStatus | null {
  if (findings.length === 0) return null;
  return findings.reduce((best, f) =>
    STATUS_META[f.status].order < STATUS_META[best.status].order ? f : best,
  ).status;
}
