// Pure classification for the semantic map: which finding (if any) does
// a chunk carry evidence for? A chunk is evidence when a finding's span
// starts inside its range; overlaps resolve to the strongest status.

import type { FindingOut, FindingStatus, SemanticPoint } from "../api/types";
import { STATUS_META } from "./status";

export interface PointClassification {
  status: FindingStatus | null;
  findingId: string | null;
}

export function classifyPoint(
  point: SemanticPoint,
  findings: FindingOut[],
): PointClassification {
  const covering = findings.filter(
    (f) =>
      f.span !== null &&
      f.span.char_start >= point.char_start &&
      f.span.char_start < point.char_end,
  );
  if (covering.length === 0) return { status: null, findingId: null };
  const strongest = covering.reduce((best, f) =>
    STATUS_META[f.status].order < STATUS_META[best.status].order ? f : best,
  );
  return { status: strongest.status, findingId: strongest.id };
}
