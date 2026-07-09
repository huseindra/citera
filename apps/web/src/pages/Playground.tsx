// The Playground is the interactive console for the Citera SDK:
// left = study configuration, center = interactive review, right = the
// real API calls this session made. The review engine is untouched —
// the full Finding Dossier experience lives at /playground/reviews/:id.

import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState, type DragEvent } from "react";
import { Activity, Check, FlaskConical, HeartPulse, Stethoscope, Wind, Zap, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { apiGet, apiPost, apiUploadWithProgress } from "../api/client";
import type {
  DocumentOut,
  FindingOut,
  ReviewOut,
  ReviewSummary,
  RuleSetOut,
  RulesetInfo,
} from "../api/types";
import {
  ApiSidebar,
  type ApiLogEntry,
} from "../components/playground/ApiSidebar";
import { RulesetBadge } from "../components/RulesetBadge";
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

// Built-in demo studies (public/samples/<base>-{protocol,icf}.md), each
// tied to the ruleset it was authored for — selecting one populates the
// whole Playground, no uploads required.
export interface SampleStudy {
  base: string;
  ruleset: string;
  title: string;
  detail: string;
  Icon: LucideIcon;
}

const SAMPLE_STUDIES: SampleStudy[] = [
  {
    base: "vtz-2201",
    ruleset: "fda-21cfr50",
    title: "Asthma Study (VTZ-2201)",
    detail: "Phase 2 · FDA 21 CFR 50.25 · English",
    Icon: Wind,
  },
  {
    base: "hsa",
    ruleset: "hsa-hpct2016",
    title: "COPD Study (SGR-204)",
    detail: "Phase 2 · HSA Singapore · English",
    Icon: Stethoscope,
  },
  {
    base: "bpom",
    ruleset: "bpom-cukb",
    title: "Studi Asma (KBR-107)",
    detail: "Fase 2 · BPOM Indonesia · Bahasa Indonesia",
    Icon: Activity,
  },
  {
    base: "tga",
    ruleset: "tga-ns-ichgcp",
    title: "Hypertension Trial (AUV-330)",
    detail: "Phase 2 · TGA Australia · English",
    Icon: HeartPulse,
  },
];

// What every review runs. These are core engine steps, not options — the
// sidebar shows them as locked capabilities instead of faking toggles.
// Suggested Revision is the one real option (a genuine API parameter).
const REVIEW_CAPABILITIES = [
  "Validate Required Elements",
  "Compare Against Study Protocol",
  "Generate Evidence",
  "Include Audit Trail",
];

export function PlaygroundPage() {
  const [ruleset, setRuleset] = useState("fda-21cfr50");
  const [withRevision, setWithRevision] = useState(true);
  const [docsNonce, setDocsNonce] = useState(0);
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

  const rulesetAlias =
    (rulesets.data ?? []).find((r) => r.id === ruleset)?.aliases[0] ?? ruleset;

  const startReview = useMutation({
    mutationFn: async () => {
      const body = {
        document_id: slots.icf.documentId!,
        protocol_document_id: slots.protocol.documentId!,
        ruleset: rulesetAlias,
        generate_suggested_revision: withRevision,
      };
      const review = await apiPost<ReviewOut>("/reviews", body);
      pushLog({
        operation: "client.reviews.create()",
        method: "POST",
        path: "/v1/reviews",
        request: {
          ruleset: rulesetAlias,
          document_id: body.document_id,
          protocol_document_id: body.protocol_document_id,
          generate_suggested_revision: withRevision,
        },
        response: { id: review.id, status: review.status, rule_count: review.rule_count },
      });
      return review;
    },
    onSuccess: (review) => setActiveReviewId(review.id),
  });

  const loadSample = useMutation({
    mutationFn: async (study: SampleStudy) => {
      setRuleset(study.ruleset);
      for (const [kind, path] of [
        ["protocol", `/samples/${study.base}-protocol.md`],
        ["icf", `/samples/${study.base}-icf.md`],
      ] as const) {
        const blob = await (await fetch(path)).blob();
        await upload(kind, new File([blob], path.split("/").pop()!, { type: "text/markdown" }));
      }
    },
  });

  const selectedRuleset = (rulesets.data ?? []).find((r) => r.id === ruleset);
  // the selector only offers available packs, but the API status gate is
  // still mirrored here as a belt-and-braces guard
  const runnable = selectedRuleset ? selectedRuleset.status === "available" : true;
  const canRun =
    slots.protocol.state === "ready" &&
    slots.icf.state === "ready" &&
    runnable &&
    !startReview.isPending;
  const review = activeReview.data ?? null;
  const running =
    review !== null && (review.status === "pending" || review.status === "running");

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
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-stone-400">
            <Zap aria-hidden className="h-3 w-3" /> Clinical Regulatory Intelligence Playground
          </div>
          <div className="text-[11px] text-stone-500">
            Run AI-powered regulatory review before integrating the SDK.
          </div>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <div>
            <div className="text-[9px] uppercase tracking-wide text-stone-400">
              Ruleset
            </div>
            {selectedRuleset ? (
              <RulesetBadge
                rulesetId={selectedRuleset.id}
                status={selectedRuleset.status}
                label={`${selectedRuleset.authority} ${selectedRuleset.name.split(" — ")[0]}`}
              />
            ) : (
              <div className="font-medium text-stone-700">—</div>
            )}
          </div>
          <HeaderStat label="Engine" value="Citera Review Engine v1" />
          <HeaderStat
            label="Status"
            value={running ? "Reviewing…" : review ? review.status : canRun ? "Ready" : "Waiting for documents"}
          />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[300px_1fr_360px]">
        {/* LEFT — review configuration: ruleset, documents, run. One
            screen, no scrolling — everything else belongs to the SDK. */}
        <div className="flex flex-col gap-4 overflow-y-auto border-r border-stone-200 bg-sidebar p-4">
          <RulesetSelector value={ruleset} onChange={setRuleset} />

          <div key={docsNonce} className={docsNonce > 0 ? "evidence-pulse rounded-xl" : ""}>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
              Documents
            </div>
            <div className="mt-1.5 space-y-2">
              <DropZone kind="protocol" title="Study Protocol" slot={slots.protocol} onFile={upload} />
              <DropZone kind="icf" title="Informed Consent Form" slot={slots.icf} onFile={upload} />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
              Review Configuration
            </div>
            <ul className="mt-1.5 space-y-1">
              {REVIEW_CAPABILITIES.map((capability) => (
                <li
                  key={capability}
                  className="flex items-center gap-2 text-xs text-stone-700"
                >
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-blue-600 text-white">
                    <Check aria-hidden className="h-2.5 w-2.5" />
                  </span>
                  {capability}
                </li>
              ))}
              <li>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-stone-700">
                  <input
                    type="checkbox"
                    checked={withRevision}
                    onChange={(e) => setWithRevision(e.target.checked)}
                    className="peer sr-only"
                  />
                  <span
                    className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border transition-colors ${
                      withRevision
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-stone-300 bg-white text-transparent"
                    }`}
                  >
                    <Check aria-hidden className="h-2.5 w-2.5" />
                  </span>
                  Generate Suggested Revision
                </label>
              </li>
            </ul>
            <p className="mt-1.5 text-[10px] leading-4 text-stone-400">
              Checked steps run in every review; Suggested Revision drafts
              AI replacement text for each non-satisfied finding.
            </p>
          </div>

          <div className="mt-auto">
            <button
              disabled={!canRun}
              onClick={() => startReview.mutate()}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-30"
            >
              {startReview.isPending ? "Starting…" : "Run Review"}
            </button>
            {startReview.isError && (
              <p className="mt-2 text-[11px] text-red-700">{(startReview.error as Error).message}</p>
            )}
          </div>
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
              onUpload={() => setDocsNonce((n) => n + 1)}
              onLoadSample={(study) => loadSample.mutate(study)}
              loading={loadSample.isPending || slots.protocol.state === "uploading"}
              sessions={(reviews.data ?? []).slice(0, 4)}
            />
          )}
        </div>

        {/* RIGHT — API Response */}
        <ApiSidebar log={apiLog} liveSnippet={buildSnippet(rulesetAlias, withRevision, slots, review)} />
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
  const ruleset = useQuery({
    queryKey: ["ruleset", review.ruleset_id],
    queryFn: () => apiGet<RuleSetOut>(`/rulesets/${review.ruleset_id}`),
    staleTime: Infinity,
  });
  // live-ticking clock while the review runs
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const total = review.rule_count || review.findings.length || 1;
  const checked = review.findings.length;
  const counts = summarize(review);
  // while running: honest "so far" score over what's been checked
  const score = Math.round((counts.satisfied / (running ? Math.max(1, checked) : total)) * 100);
  const coverage = Math.round(
    (review.findings.filter((f) => f.span || (f.queries_executed ?? []).length > 0)
      .length /
      Math.max(1, running ? checked : total)) *
      100,
  );
  const duration = running
    ? liveDuration(review.created_at, now)
    : reviewDuration(review);
  const progress = Math.round((checked / total) * 100);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-stone-800">
            Compliance Summary
          </h2>
          {running ? (
            <span className="text-[11px] font-medium text-sky-600">
              {checked}/{total} requirements checked
            </span>
          ) : (
            checked > 0 && (
              <span className="text-[11px] font-medium text-stone-500">
                {score}% compliant · {counts.satisfied}/{total} satisfied
              </span>
            )
          )}
        </div>
        {/* progress bar — the review is a process, show it as one */}
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-stone-100">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              running ? "bg-sky-500" : counts.critical > 0 ? "bg-red-400" : "bg-green-500"
            }`}
            style={{ width: `${running ? Math.max(4, progress) : 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2">
        <Metric
          label="Critical"
          value={checked === 0 ? "—" : String(counts.critical)}
          tone={counts.critical > 0 ? "bad" : "good"}
          pulse={running}
        />
        <Metric
          label="Major"
          value={checked === 0 ? "—" : String(counts.major)}
          tone={counts.major > 0 ? "warn" : "good"}
          pulse={running}
        />
        <Metric
          label="Minor"
          value={checked === 0 ? "—" : String(counts.minor)}
          pulse={running}
        />
        <Metric
          label={running ? "Evidence (so far)" : "Evidence coverage"}
          value={checked === 0 ? "—" : `${coverage}%`}
          pulse={running}
        />
        <Metric label="Duration" value={duration} pulse={running} />
        <Metric label="Ruleset" value={rulesetVersion} />
      </div>

      {!running && <ResultActions review={review} onExportLogged={onExportLogged} />}

      <div>
        <h3 className="text-xs font-semibold text-stone-800">Findings</h3>
        <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
          <TheaterRows
            review={review}
            rules={ruleset.data?.rules ?? []}
            running={running}
          />
        </ul>
        <p className="mt-2 text-[11px] text-stone-400">
          Click a finding to open its full dossier — evidence, requirement,
          analysis, and audit timeline.
        </p>
      </div>
    </div>
  );
}

function ResultActions({
  review,
  onExportLogged,
}: {
  review: ReviewOut;
  onExportLogged: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const firstIssue =
    sortForDisplay(review.findings).find((f) => f.status !== "satisfied") ??
    review.findings[0];

  return (
    <div className="flex gap-2 text-xs">
      <Link
        to={`/playground/reviews/${review.id}/report`}
        onClick={onExportLogged}
        className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
      >
        Export PDF
      </Link>
      <button
        onClick={() => downloadJson(review)}
        className="rounded-lg border border-stone-300 px-3 py-1.5 font-medium text-stone-600 hover:bg-stone-50"
      >
        Download JSON
      </button>
      <button
        onClick={() => {
          navigator.clipboard.writeText(JSON.stringify(review, null, 2));
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
        className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-1.5 font-medium text-stone-600 hover:bg-stone-50"
      >
        {copied && <Check aria-hidden className="h-3 w-3 text-green-600" />}
        {copied ? "Copied" : "Copy API Response"}
      </button>
      {firstIssue && (
        <Link
          to={`/playground/reviews/${review.id}?finding=${firstIssue.id}`}
          className="rounded-lg border border-stone-300 px-3 py-1.5 font-medium text-stone-600 hover:bg-stone-50"
        >
          Open Finding
        </Link>
      )}
    </div>
  );
}

/** All requirements visible from second one: completed rows are findings,
 *  the next rule is honestly "analyzing" (the engine is sequential), the
 *  rest are queued. The list is never empty while a review runs. */
function TheaterRows({
  review,
  rules,
  running,
}: {
  review: ReviewOut;
  rules: RuleSetOut["rules"];
  running: boolean;
}) {
  const byRule = new Map(review.findings.map((f) => [f.rule_id, f]));

  const findingRow = (f: FindingOut) => {
    const meta = STATUS_META[f.status];
    return (
      <li key={f.id} className="finding-lands">
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
            <meta.Icon aria-hidden className="h-3 w-3" />
            {meta.label}
          </span>
        </Link>
      </li>
    );
  };

  if (!running || rules.length === 0) {
    if (review.findings.length === 0) {
      return (
        <li className="px-4 py-4 text-xs text-stone-400">
          No findings recorded for this review.
        </li>
      );
    }
    return <>{sortForDisplay(review.findings).map(findingRow)}</>;
  }

  // theater: ruleset order, engine evaluates sequentially
  return (
    <>
      {rules.map((rule, index) => {
        const finding = byRule.get(rule.id);
        if (finding) return findingRow(finding);
        const active = index === review.findings.length;
        return (
          <li
            key={rule.id}
            className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${
              active ? "" : "opacity-50"
            }`}
            aria-busy={active}
          >
            <div className="min-w-0">
              <div className={`truncate font-medium ${active ? "text-stone-800" : "text-stone-400"}`}>
                {rule.title}
              </div>
              <div className="text-[11px] text-stone-400">
                {rule.citation} · {rule.severity}
              </div>
              {active && (
                <div className="mt-1.5 h-1 w-44 overflow-hidden rounded-full bg-stone-100">
                  <div className="theater-shimmer h-full w-1/3 rounded-full bg-sky-300" />
                </div>
              )}
            </div>
            {active ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
                </span>
                Analyzing…
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[11px] text-stone-400">
                queued
              </span>
            )}
          </li>
        );
      })}
    </>
  );
}

function sortForDisplay(findings: FindingOut[]): FindingOut[] {
  return [...findings].sort(
    (a, b) => STATUS_META[a.status].order - STATUS_META[b.status].order,
  );
}

function Metric({
  label,
  value,
  tone,
  pulse,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad";
  pulse?: boolean;
}) {
  const toneClass =
    tone === "good"
      ? "text-green-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "bad"
          ? "text-red-700"
          : "text-stone-900";
  return (
    <div
      className={`rounded-xl border bg-white p-3 ${
        pulse ? "border-sky-200" : "border-stone-200"
      }`}
    >
      <div className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-stone-400">
        {label}
        {pulse && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-500" />
          </span>
        )}
      </div>
      <div className={`mt-0.5 truncate text-base font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function EmptyState({
  onUpload,
  onLoadSample,
  loading,
  sessions,
}: {
  onUpload: () => void;
  onLoadSample: (study: SampleStudy) => void;
  loading: boolean;
  sessions: ReviewSummary[];
}) {
  return (
    <div className="mx-auto max-w-md pt-14 text-center">
      <FlaskConical aria-hidden className="mx-auto h-8 w-8 text-stone-300" />
      <p className="mt-3 text-sm leading-6 text-stone-600">
        Upload a Study Protocol and an Informed Consent Form — or load a
        built-in sample study. Each sample selects its ruleset
        automatically; no uploads required.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-left">
        {SAMPLE_STUDIES.map((study) => (
          <button
            key={study.base}
            onClick={() => onLoadSample(study)}
            disabled={loading}
            className="rounded-xl border border-stone-200 bg-white p-3 transition-colors hover:border-blue-600 disabled:opacity-40"
          >
            <study.Icon aria-hidden className="h-4 w-4 text-blue-600" />
            <div className="mt-1.5 text-xs font-semibold text-stone-800">
              {study.title}
            </div>
            <div className="text-[10px] text-stone-400">{study.detail}</div>
          </button>
        ))}
      </div>
      <div className="mt-3">
        <button
          onClick={onUpload}
          className="rounded-lg border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
        >
          {loading ? "Loading sample…" : "Upload Documents"}
        </button>
      </div>
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
          ? "border-green-300 bg-green-50/50"
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
          <span className="inline-flex items-center gap-1 font-medium text-green-700"><Check aria-hidden className="h-3 w-3" /> {displayName(slot.filename)}</span>
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
  withRevision: boolean,
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
      `  suggestedRevision: ${withRevision},`,
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

function liveDuration(startedAt: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(startedAt).getTime()) / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
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
