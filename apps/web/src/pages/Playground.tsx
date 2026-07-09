// The Playground is the interactive console for the Citera SDK:
// left = study configuration, center = interactive review, right = the
// real API calls this session made. The review engine is untouched —
// the full Finding Dossier experience lives at /playground/reviews/:id.

import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost, apiUploadWithProgress } from "../api/client";
import type {
  DocumentOut,
  FindingOut,
  ReviewOut,
  ReviewSummary,
  RulesetInfo,
} from "../api/types";
import {
  ApiSidebar,
  type ApiLogEntry,
} from "../components/playground/ApiSidebar";
import { RulesetSelector } from "../components/playground/RulesetSelector";
import { displayName, timeAgo } from "../lib/format";
import { STATUS_META } from "../lib/status";

type SlotKind = "protocol" | "icf";

interface Slot {
  documentId: string | null;
  filename: string | null;
  state: "empty" | "uploading" | "processing" | "ready" | "failed";
  progress?: number;
  error?: string;
}

const EMPTY_SLOT: Slot = { documentId: null, filename: null, state: "empty" };
const PHASES = ["Phase I", "Phase II", "Phase III", "Phase IV"];

export function PlaygroundPage() {
  const [ruleset, setRuleset] = useState("fda-21cfr50");
  const [phase, setPhase] = useState("Phase II");
  const [slots, setSlots] = useState<Record<SlotKind, Slot>>({
    protocol: EMPTY_SLOT,
    icf: EMPTY_SLOT,
  });
  const [apiLog, setApiLog] = useState<ApiLogEntry[]>([]);
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);

  const pushLog = (entry: ApiLogEntry) =>
    setApiLog((prev) => [...prev.slice(-11), entry]);

  const rulesets = useQuery({
    queryKey: ["rulesets"],
    queryFn: () => apiGet<RulesetInfo[]>("/rulesets"),
    staleTime: Infinity,
  });
  const documents = useQuery({
    queryKey: ["documents"],
    queryFn: () => apiGet<DocumentOut[]>("/documents"),
    refetchInterval: () =>
      Object.values(slots).some((s) => s.state === "processing") ? 1200 : false,
  });
  const reviews = useQuery({
    queryKey: ["reviews"],
    queryFn: () => apiGet<ReviewSummary[]>("/reviews"),
  });
  const activeReview = useQuery({
    queryKey: ["review", activeReviewId],
    queryFn: () => apiGet<ReviewOut>(`/reviews/${activeReviewId}`),
    enabled: !!activeReviewId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "pending" || s === "running" ? 1200 : false;
    },
  });

  // promote processing slots once the poll sees a terminal document state
  const docs = documents.data;
  useEffect(() => {
    if (!docs) return;
    const byId = new Map(docs.map((d) => [d.id, d]));
    setSlots((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const kind of ["protocol", "icf"] as SlotKind[]) {
        const slot = prev[kind];
        if (slot.state !== "processing" || !slot.documentId) continue;
        const doc = byId.get(slot.documentId);
        if (doc?.status === "ready") {
          next[kind] = { ...slot, state: "ready" };
          changed = true;
        } else if (doc?.status === "failed") {
          next[kind] = { ...slot, state: "failed", error: doc.status_reason ?? "" };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [docs]);

  const upload = useCallback(async (kind: SlotKind, file: File) => {
    setSlots((prev) => ({
      ...prev,
      [kind]: { documentId: null, filename: file.name, state: "uploading", progress: 0 },
    }));
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      const doc = await apiUploadWithProgress<DocumentOut>("/documents", form, (p) =>
        setSlots((prev) => ({ ...prev, [kind]: { ...prev[kind], progress: p } })),
      );
      pushLog({
        operation: "client.documents.upload()",
        method: "POST",
        path: "/v1/documents",
        request: { file: file.name, kind },
        response: doc,
      });
      setSlots((prev) => ({
        ...prev,
        [kind]: {
          documentId: doc.id,
          filename: doc.filename,
          state: doc.status === "ready" ? "ready" : "processing",
        },
      }));
    } catch (err) {
      setSlots((prev) => ({
        ...prev,
        [kind]: { ...prev[kind], state: "failed", error: (err as Error).message },
      }));
    }
  }, []);

  const startReview = useMutation({
    mutationFn: async () => {
      const body = {
        document_id: slots.icf.documentId!,
        protocol_document_id: slots.protocol.documentId!,
        ruleset_id: ruleset,
      };
      const review = await apiPost<ReviewOut>("/reviews", body);
      pushLog({
        operation: "client.reviews.create()",
        method: "POST",
        path: "/v1/reviews",
        request: { ruleset, document_id: body.document_id, protocol_document_id: body.protocol_document_id },
        response: { id: review.id, status: review.status, rule_count: review.rule_count },
      });
      return review;
    },
    onSuccess: (review) => setActiveReviewId(review.id),
  });

  const loadSample = useMutation({
    mutationFn: async () => {
      for (const [kind, path] of [
        ["protocol", "/samples/vtz-2201-protocol.md"],
        ["icf", "/samples/vtz-2201-icf.md"],
      ] as const) {
        const blob = await (await fetch(path)).blob();
        await upload(kind, new File([blob], path.split("/").pop()!, { type: "text/markdown" }));
      }
    },
  });

  const canRun =
    slots.protocol.state === "ready" &&
    slots.icf.state === "ready" &&
    !startReview.isPending;
  const review = activeReview.data ?? null;
  const running =
    review !== null && (review.status === "pending" || review.status === "running");
  const selectedRuleset = (rulesets.data ?? []).find((r) => r.id === ruleset);

  // log completion once
  const reviewStatus = review?.status;
  useEffect(() => {
    if (reviewStatus === "complete" && review) {
      pushLog({
        operation: "client.reviews.waitUntilComplete()",
        method: "GET",
        path: `/v1/reviews/${review.id}`,
        response: summarize(review),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewStatus]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-2.5">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
            ⚡ Clinical Regulatory Intelligence Playground
          </div>
          <div className="text-[11px] text-stone-500">
            Run AI-powered regulatory review before integrating the SDK.
          </div>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <HeaderStat label="Ruleset" value={selectedRuleset?.authority ?? "—"} />
          <HeaderStat label="Study" value="Demo Study" />
          <HeaderStat
            label="Status"
            value={running ? "Reviewing…" : review ? review.status : canRun ? "Ready" : "Waiting for documents"}
          />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[300px_1fr_360px]">
        {/* LEFT — Study Configuration */}
        <div className="space-y-4 overflow-y-auto border-r border-stone-200 bg-white p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
            Study Configuration
          </div>
          <RulesetSelector value={ruleset} onChange={setRuleset} />
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                Study type
              </span>
              <select className="mt-1 w-full rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs" defaultValue="Clinical Trial">
                <option>Clinical Trial</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                Phase
              </span>
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                className="mt-1 w-full rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs"
              >
                {PHASES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>
          <DropZone kind="protocol" title="Protocol" slot={slots.protocol} onFile={upload} />
          <DropZone kind="icf" title="Informed Consent Form" slot={slots.icf} onFile={upload} />
          <button
            disabled={!canRun}
            onClick={() => startReview.mutate()}
            className="w-full rounded-lg bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white transition-opacity disabled:opacity-30"
          >
            {startReview.isPending ? "Starting…" : "Run Review"}
          </button>
          {startReview.isError && (
            <p className="text-[11px] text-red-700">{(startReview.error as Error).message}</p>
          )}
        </div>

        {/* CENTER — Interactive Review */}
        <div className="overflow-y-auto p-5">
          {review ? (
            <ReviewResults
              review={review}
              running={running}
              rulesetVersion={selectedRuleset?.version ?? review.ruleset_version}
              onExportLogged={() =>
                pushLog({
                  operation: "client.reports.export()",
                  method: "GET",
                  path: `/v1/reviews/${review.id}/report`,
                })
              }
            />
          ) : (
            <EmptyState
              onLoadSample={() => loadSample.mutate()}
              loading={loadSample.isPending || slots.protocol.state === "uploading"}
              sessions={(reviews.data ?? []).slice(0, 4)}
            />
          )}
        </div>

        {/* RIGHT — API Response */}
        <ApiSidebar log={apiLog} liveSnippet={buildSnippet(ruleset, slots, review)} />
      </div>
    </div>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-stone-400">{label}</div>
      <div className="font-medium text-stone-700">{value}</div>
    </div>
  );
}

function summarize(review: ReviewOut) {
  const by = (fn: (f: FindingOut) => boolean) => review.findings.filter(fn).length;
  return {
    review_id: review.id,
    status: review.status,
    critical: by((f) => f.status !== "satisfied" && f.severity === "critical"),
    major: by((f) => f.status !== "satisfied" && f.severity === "major"),
    minor: by((f) => f.status !== "satisfied" && f.severity === "minor"),
    satisfied: by((f) => f.status === "satisfied"),
  };
}

function ReviewResults({
  review,
  running,
  rulesetVersion,
  onExportLogged,
}: {
  review: ReviewOut;
  running: boolean;
  rulesetVersion: string;
  onExportLogged: () => void;
}) {
  const total = review.rule_count || review.findings.length || 1;
  const counts = summarize(review);
  const score = Math.round((counts.satisfied / total) * 100);
  const coverage = Math.round(
    (review.findings.filter((f) => f.span || (f.queries_executed ?? []).length > 0)
      .length /
      total) *
      100,
  );
  const duration = reviewDuration(review);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-stone-800">Review Summary</h2>
        {running && (
          <p className="text-[11px] text-sky-600">
            Checking requirement {review.findings.length + 1} of {total}…
          </p>
        )}
      </div>

      <div className="grid grid-cols-5 gap-2">
        <Metric label="Compliance score" value={running ? "…" : `${score}%`} tone={score === 100 ? "good" : score >= 60 ? "warn" : "bad"} />
        <Metric label="Evidence coverage" value={running ? "…" : `${coverage}%`} />
        <Metric label="Critical findings" value={String(counts.critical)} tone={counts.critical > 0 ? "bad" : "good"} />
        <Metric label="Review duration" value={running ? "running" : duration} />
        <Metric label="Ruleset" value={rulesetVersion} />
      </div>

      {!running && (
        <div className="flex gap-2 text-xs">
          <Link
            to={`/playground/reviews/${review.id}/report`}
            onClick={onExportLogged}
            className="rounded-md bg-stone-900 px-3 py-1.5 font-medium text-white"
          >
            Export Report
          </Link>
          <button
            onClick={() => downloadJson(review)}
            className="rounded-md border border-stone-300 px-3 py-1.5 font-medium text-stone-600 hover:bg-stone-50"
          >
            Download JSON
          </button>
          <button
            onClick={() =>
              navigator.clipboard.writeText(
                `curl -s -X POST http://localhost:8000/v1/reviews \\\n  -H "Authorization: Bearer $CITERA_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"ruleset_id": "${review.ruleset_id}", "document_id": "${review.document_id}", "protocol_document_id": "${review.protocol_document_id}"}'`,
              )
            }
            className="rounded-md border border-stone-300 px-3 py-1.5 font-medium text-stone-600 hover:bg-stone-50"
          >
            Copy API Request
          </button>
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold text-stone-800">Findings</h3>
        <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {review.findings.map((f) => {
            const meta = STATUS_META[f.status];
            return (
              <li key={f.id}>
                <Link
                  to={`/playground/reviews/${review.id}?finding=${f.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-stone-50"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-stone-800">
                      {f.rule_title ?? f.rule_id}
                    </div>
                    <div className="text-[11px] text-stone-400">
                      {f.citation} · {f.severity}
                    </div>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.chip}`}
                  >
                    <span aria-hidden>{meta.icon}</span>
                    {meta.label}
                  </span>
                </Link>
              </li>
            );
          })}
          {review.findings.length === 0 && (
            <li className="px-4 py-4 text-xs text-stone-400">Waiting for the first finding…</li>
          )}
        </ul>
        <p className="mt-2 text-[11px] text-stone-400">
          Click a finding to open its full dossier — evidence, requirement,
          analysis, and audit timeline.
        </p>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "bad"
          ? "text-red-700"
          : "text-stone-900";
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="text-[9px] font-medium uppercase tracking-wide text-stone-400">
        {label}
      </div>
      <div className={`mt-0.5 truncate text-base font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function EmptyState({
  onLoadSample,
  loading,
  sessions,
}: {
  onLoadSample: () => void;
  loading: boolean;
  sessions: ReviewSummary[];
}) {
  return (
    <div className="mx-auto max-w-md pt-14 text-center">
      <div className="text-3xl" aria-hidden>
        ⚗️
      </div>
      <p className="mt-3 text-sm leading-6 text-stone-600">
        Upload a protocol and an informed consent form to experience the
        Clinical Regulatory Intelligence SDK — or run one of our sample
        studies.
      </p>
      <button
        onClick={onLoadSample}
        disabled={loading}
        className="mt-4 rounded-lg bg-stone-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
      >
        {loading ? "Loading sample…" : "Load Sample (VTZ-2201)"}
      </button>
      {sessions.length > 0 && (
        <div className="mt-10 text-left">
          <div className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
            Recent sessions
          </div>
          <ul className="mt-2 space-y-1">
            {sessions.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/playground/reviews/${r.id}`}
                  className="flex justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs hover:bg-stone-50"
                >
                  <span className="text-stone-700">{displayName(r.document_filename)}</span>
                  <span className="text-stone-400">{timeAgo(r.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DropZone({
  kind,
  title,
  slot,
  onFile,
}: {
  kind: SlotKind;
  title: string;
  slot: Slot;
  onFile: (kind: SlotKind, file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(kind, file);
  };
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`block cursor-pointer rounded-xl border-2 border-dashed p-3 text-center transition-colors ${
        slot.state === "ready"
          ? "border-emerald-300 bg-emerald-50/50"
          : slot.state === "failed"
            ? "border-red-300 bg-red-50/50"
            : dragging
              ? "border-stone-500 bg-stone-50"
              : "border-stone-200 hover:border-stone-400"
      }`}
    >
      <input
        type="file"
        accept=".md,.markdown,.txt,.pdf,.docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(kind, file);
          e.target.value = "";
        }}
      />
      <div className="text-[11px] font-semibold text-stone-700">{title}</div>
      <div className="mt-1 text-[11px]">
        {slot.state === "empty" && <span className="text-stone-400">drop or click</span>}
        {slot.state === "uploading" && (
          <span className="text-sky-600">uploading {slot.progress ?? 0}%</span>
        )}
        {slot.state === "processing" && <span className="text-sky-600">indexing…</span>}
        {slot.state === "ready" && (
          <span className="font-medium text-emerald-700">✓ {displayName(slot.filename)}</span>
        )}
        {slot.state === "failed" && (
          <span className="text-red-600">failed — {slot.error}</span>
        )}
      </div>
    </label>
  );
}

function buildSnippet(
  ruleset: string,
  slots: Record<SlotKind, Slot>,
  review: ReviewOut | null,
): string {
  const lines = [
    `import { Citera } from "@citera/sdk";`,
    ``,
    `const client = new Citera({`,
    `  apiKey: process.env.CITERA_API_KEY,`,
    `});`,
  ];
  if (slots.protocol.documentId) {
    lines.push(
      ``,
      `const protocol = await client.documents.upload({`,
      `  file: "${slots.protocol.filename}", kind: "protocol",`,
      `}); // → ${slots.protocol.documentId.slice(0, 8)}…`,
    );
  }
  if (slots.icf.documentId) {
    lines.push(
      `const icf = await client.documents.upload({`,
      `  file: "${slots.icf.filename}", kind: "icf",`,
      `}); // → ${slots.icf.documentId.slice(0, 8)}…`,
    );
  }
  if (review) {
    lines.push(
      ``,
      `const review = await client.reviews.create({`,
      `  ruleset: "${ruleset}",`,
      `  protocol: protocol.id, icf: icf.id,`,
      `});`,
      `const result = await client.reviews.waitUntilComplete(review.id);`,
      `console.log(result.findings); // ${review.findings.length} findings`,
    );
  } else {
    lines.push(
      ``,
      `// upload both documents, then:`,
      `// const review = await client.reviews.create({ ruleset: "${ruleset}", … })`,
    );
  }
  return lines.join("\n");
}

function reviewDuration(review: ReviewOut): string {
  if (review.findings.length === 0) return "—";
  const start = new Date(review.created_at).getTime();
  const end = Math.max(
    ...review.findings.map((f) => new Date(f.created_at).getTime()),
  );
  const seconds = Math.max(1, Math.round((end - start) / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function downloadJson(review: ReviewOut) {
  const blob = new Blob([JSON.stringify(review, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `citera-review-${review.id.slice(0, 8)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
