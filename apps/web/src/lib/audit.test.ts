import { describe, expect, it } from "vitest";
import type { AuditRecordOut } from "../api/types";
import { recordedModel, stepMeta } from "./audit";

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
