import { describe, expect, it } from "vitest";
import type { AuditRecordOut } from "../api/types";
import { extractPromptBlocks, recordedModel, stepMeta } from "./audit";

describe("extractPromptBlocks", () => {
  it("returns stored prompt text byte-for-byte", () => {
    const system = "You are a reviewer.\n  SECURITY RULE — weird  spacing\t.";
    const protocol = "<study_protocol>\nProtocol §6 — risks ~3%\n</study_protocol>";
    const rule = "Requirement: 21 CFR 50.25(a)(2) “risks”";
    const payload = {
      prompt: {
        system: [{ text: system, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: [
              { text: protocol, cache_control: { type: "ephemeral" } },
              { text: rule },
            ],
          },
        ],
      },
    };
    const blocks = extractPromptBlocks(payload);
    expect(blocks).toHaveLength(3);
    // identity, not similarity — the record-and-show claim
    expect(blocks[0]).toEqual({ role: "system", text: system, cached: true });
    expect(blocks[1]).toEqual({ role: "user", text: protocol, cached: true });
    expect(blocks[2]).toEqual({ role: "user", text: rule, cached: false });
  });

  it("handles scripted-evaluator payloads without a prompt shape", () => {
    expect(extractPromptBlocks({ prompt: { scripted: true } })).toEqual([]);
    expect(extractPromptBlocks({})).toEqual([]);
  });
});

describe("step metadata", () => {
  it("covers every pipeline step", () => {
    for (const step of [
      "ingest.extract",
      "ingest.chunk",
      "ingest.embed",
      "retrieve",
      "evaluate.prompt",
      "evaluate.response",
      "grounding.passed",
      "grounding.failed",
      "finding.persisted",
    ]) {
      expect(stepMeta(step).label).not.toBe(step); // has a human label
    }
  });

  it("unknown steps fall back instead of crashing", () => {
    expect(stepMeta("future.step").label).toBe("future.step");
  });
});

describe("recordedModel", () => {
  it("reads the model stamp from the recorded evaluation", () => {
    const records: AuditRecordOut[] = [
      { id: "1", step: "retrieve", created_at: "", payload: {} },
      {
        id: "2",
        step: "evaluate.prompt",
        created_at: "",
        payload: { model: "scripted-demo" },
      },
    ];
    expect(recordedModel(records)).toBe("scripted-demo");
    expect(recordedModel([])).toBeNull();
  });
});
