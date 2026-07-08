import type { FindingStatus } from "../api/types";

// Colors carry information, never decoration — and never color alone:
// every status also has an icon and a label (design-principles.md).
// not_found is deliberately distinct from conflicting: "absent" and
// "contradicts the protocol" are different facts for a reviewer.
export interface StatusMeta {
  label: string;
  icon: string;
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
    icon: "✗",
    chip: "bg-red-50 text-red-700 border-red-200",
    mark: "bg-red-100 border-b-2 border-red-400",
    order: 0,
  },
  not_found: {
    label: "Not found",
    icon: "∅",
    chip: "bg-violet-50 text-violet-700 border-violet-200",
    mark: "",
    order: 1,
  },
  partial: {
    label: "Partial",
    icon: "△",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
    mark: "bg-amber-100 border-b-2 border-amber-400",
    order: 2,
  },
  evaluation_failed: {
    label: "Not evaluated",
    icon: "!",
    chip: "bg-stone-100 text-stone-600 border-stone-300",
    mark: "",
    order: 3,
  },
  satisfied: {
    label: "Satisfied",
    icon: "✓",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    mark: "bg-emerald-50 border-b-2 border-emerald-300",
    order: 4,
  },
};

export const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  major: 1,
  minor: 2,
};
