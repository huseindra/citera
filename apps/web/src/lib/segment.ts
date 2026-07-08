// Pure segmentation: split canonical text at span boundaries so the
// viewer can wrap evidence in <mark> elements. Offsets index into the
// exact text being rendered — the frontend half of the evidence-span
// contract. Overlapping spans stack finding ids; the strongest status
// (STATUS_META.order) decides the color.

import type { FindingOut, FindingStatus } from "../api/types";
import { STATUS_META } from "./status";

export interface Segment {
  text: string;
  /** finding ids covering this segment (empty = plain text) */
  findingIds: string[];
  /** strongest status among covering findings; null for plain text */
  status: FindingStatus | null;
}

export function segment(text: string, findings: FindingOut[]): Segment[] {
  const spanned = findings.filter(
    (f) =>
      f.span !== null &&
      f.span.char_start < f.span.char_end &&
      f.span.char_start >= 0 &&
      f.span.char_end <= text.length,
  );
  if (spanned.length === 0) {
    return text ? [{ text, findingIds: [], status: null }] : [];
  }

  const boundaries = new Set<number>([0, text.length]);
  for (const f of spanned) {
    boundaries.add(f.span!.char_start);
    boundaries.add(f.span!.char_end);
  }
  const sorted = [...boundaries].sort((a, b) => a - b);

  const segments: Segment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start === end) continue;
    const covering = spanned.filter(
      (f) => f.span!.char_start <= start && f.span!.char_end >= end,
    );
    segments.push({
      text: text.slice(start, end),
      findingIds: covering.map((f) => f.id),
      status: strongestStatus(covering),
    });
  }
  return segments;
}

function strongestStatus(findings: FindingOut[]): FindingStatus | null {
  if (findings.length === 0) return null;
  return findings.reduce((best, f) =>
    STATUS_META[f.status].order < STATUS_META[best.status].order ? f : best,
  ).status;
}
