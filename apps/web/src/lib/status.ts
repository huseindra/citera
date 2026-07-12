import {
  Check,
  CircleAlert,
  SearchX,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import type { FindingStatus } from "../api/types";

// Colors carry information, never decoration — and never color alone:
// every status also has an icon and a label (design-principles.md).
// not_found is deliberately distinct from conflicting: "absent" and
// "contradicts the protocol" are different facts for a reviewer.
export interface StatusMeta {
  label: string;
  Icon: LucideIcon;
  /** matrix chip */
  chip: string;
  /** document highlight; empty = this status never has a span */
  mark: string;
  /** severity order for sorting and overlap resolution (lower = stronger) */
  order: number;
}

export const STATUS_META: Record<FindingStatus, StatusMeta> = {
  conflicting: {
    label: "Conflicting",
    Icon: X,
    chip: "bg-red-50 text-red-700 border-red-200",
    mark: "bg-red-100 border-b-2 border-red-400",
    order: 0,
  },
  not_found: {
    label: "Not found",
    Icon: SearchX,
    chip: "bg-sky-50 text-sky-700 border-sky-200",
    mark: "",
    order: 1,
  },
  partial: {
    label: "Partial",
    Icon: TriangleAlert,
    chip: "bg-amber-50 text-amber-700 border-amber-200",
    mark: "bg-amber-100 border-b-2 border-amber-400",
    order: 2,
  },
  evaluation_failed: {
    label: "Not evaluated",
    Icon: CircleAlert,
    chip: "bg-stone-100 text-stone-600 border-stone-300",
    mark: "",
    order: 3,
  },
  satisfied: {
    label: "Satisfied",
    Icon: Check,
    chip: "bg-green-50 text-green-700 border-green-200",
    mark: "bg-green-50 border-b-2 border-green-300",
    order: 4,
  },
};

export const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  major: 1,
  minor: 2,
};

// Review job states, reviewer-facing wording (API keeps the raw values)
export const REVIEW_STATUS_LABEL: Record<string, string> = {
  pending: "Queued",
  running: "Processing",
  complete: "Completed",
  failed: "Failed",
};

export const REVIEW_STATUS_CHIP: Record<string, string> = {
  pending: "bg-stone-100 text-stone-600 border-stone-300",
  running: "bg-sky-50 text-sky-700 border-sky-200",
  complete: "bg-green-50 text-green-700 border-green-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};
