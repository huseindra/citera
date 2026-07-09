// Presentation metadata for audit steps + verbatim prompt extraction.
// Record-and-show: these helpers format and extract — they never alter
// recorded content. The prompt text returned by extractPromptText is the
// stored string, byte for byte.

import {
  ArrowLeft,
  ArrowRight,
  Blocks,
  Check,
  Circle,
  Database,
  FileText,
  Network,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import type { AuditRecordOut } from "../api/types";

export interface StepMeta {
  label: string;
  Icon: LucideIcon;
  tone: string;
}

export const STEP_META: Record<string, StepMeta> = {
  "ingest.extract": { label: "Text extracted", Icon: FileText, tone: "text-stone-500" },
  "ingest.chunk": { label: "Chunked with spans", Icon: Blocks, tone: "text-stone-500" },
  "ingest.embed": { label: "Embedded", Icon: Network, tone: "text-stone-500" },
  retrieve: { label: "Hybrid retrieval", Icon: Search, tone: "text-sky-600" },
  "evaluate.prompt": { label: "Prompt sent", Icon: ArrowRight, tone: "text-stone-700" },
  "evaluate.response": { label: "Model response", Icon: ArrowLeft, tone: "text-stone-700" },
  "grounding.passed": { label: "Quote grounded", Icon: Check, tone: "text-emerald-600" },
  "grounding.failed": { label: "Grounding rejected", Icon: X, tone: "text-red-600" },
  "finding.persisted": { label: "Finding persisted", Icon: Database, tone: "text-stone-800" },
};

export function stepMeta(step: string): StepMeta {
  return STEP_META[step] ?? { label: step, Icon: Circle, tone: "text-stone-500" };
}

/** The model stamp for the replay header, from the recorded evaluation. */
export function recordedModel(records: AuditRecordOut[]): string | null {
  const evaluation = records.find((r) => r.step === "evaluate.prompt");
  const model = evaluation?.payload["model"];
  return typeof model === "string" ? model : null;
}
