// Presentation metadata for audit steps + verbatim prompt extraction.
// Record-and-show: these helpers format and extract — they never alter
// recorded content. The prompt text returned by extractPromptText is the
// stored string, byte for byte.

import type { AuditRecordOut } from "../api/types";

export interface StepMeta {
  label: string;
  icon: string;
  tone: string;
}

export const STEP_META: Record<string, StepMeta> = {
  "ingest.extract": { label: "Text extracted", icon: "⇣", tone: "text-stone-500" },
  "ingest.chunk": { label: "Chunked with spans", icon: "▤", tone: "text-stone-500" },
  "ingest.embed": { label: "Embedded", icon: "∴", tone: "text-stone-500" },
  retrieve: { label: "Hybrid retrieval", icon: "⌕", tone: "text-sky-600" },
  "evaluate.prompt": { label: "Prompt sent", icon: "→", tone: "text-stone-700" },
  "evaluate.response": { label: "Model response", icon: "←", tone: "text-stone-700" },
  "grounding.passed": { label: "Quote grounded", icon: "✓", tone: "text-emerald-600" },
  "grounding.failed": { label: "Grounding rejected", icon: "✗", tone: "text-red-600" },
  "finding.persisted": { label: "Finding persisted", icon: "◆", tone: "text-stone-800" },
};

export function stepMeta(step: string): StepMeta {
  return STEP_META[step] ?? { label: step, icon: "·", tone: "text-stone-500" };
}

interface PromptBlock {
  role: string;
  text: string;
  cached: boolean;
}

/** Flatten the recorded prompt payload into displayable blocks. Text is
 *  passed through untouched — what renders is what was sent. */
export function extractPromptBlocks(
  payload: Record<string, unknown>,
): PromptBlock[] {
  const prompt = payload["prompt"] as
    | {
        system?: { text?: string; cache_control?: unknown }[];
        messages?: {
          role?: string;
          content?: { text?: string; cache_control?: unknown }[];
        }[];
      }
    | undefined
    | null;
  if (!prompt) return [];

  const blocks: PromptBlock[] = [];
  for (const b of prompt.system ?? []) {
    if (typeof b.text === "string") {
      blocks.push({ role: "system", text: b.text, cached: !!b.cache_control });
    }
  }
  for (const message of prompt.messages ?? []) {
    for (const b of message.content ?? []) {
      if (typeof b.text === "string") {
        blocks.push({
          role: message.role ?? "user",
          text: b.text,
          cached: !!b.cache_control,
        });
      }
    }
  }
  return blocks;
}

/** The model stamp for the replay header, from the recorded evaluation. */
export function recordedModel(records: AuditRecordOut[]): string | null {
  const evaluation = records.find((r) => r.step === "evaluate.prompt");
  const model = evaluation?.payload["model"];
  return typeof model === "string" ? model : null;
}
