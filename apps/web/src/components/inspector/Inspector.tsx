// The right-column Evidence Inspector: one scrolling column in the
// product hierarchy order (Evidence → Reasoning → Finding detail).
// Nothing important lives in a tab — retrieval and audit are collapsed
// sections, one click away.

import { useQuery } from "@tanstack/react-query";
import { Suspense, lazy } from "react";
import { apiGet } from "../../api/client";
import type { FindingEvidenceOut, FindingOut } from "../../api/types";
import { STATUS_META } from "../../lib/status";
import { AuditReplay } from "../finding/AuditReplay";

const CitationGraphView = lazy(() =>
  import("../finding/CitationGraph").then((m) => ({
    default: m.CitationGraphView,
  })),
);

interface Props {
  reviewId: string;
  finding: FindingOut;
  evaluatorModel: string | null;
  onClose: () => void;
  onScrollToOffset: (offset: number) => void;
}

export function Inspector({
  reviewId,
  finding,
  evaluatorModel,
  onClose,
  onScrollToOffset,
}: Props) {
  const meta = STATUS_META[finding.status];
  const evidence = useQuery({
    queryKey: ["finding-evidence", finding.id],
    queryFn: () =>
      apiGet<FindingEvidenceOut>(
        `/reviews/${reviewId}/findings/${finding.id}/evidence`,
      ),
    retry: false,
  });

  return (
    <aside className="flex h-full flex-col border-l border-stone-200 bg-white">
      <div className="flex items-start justify-between gap-2 border-b border-stone-100 px-4 py-3">
        <div className="min-w-0">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.chip}`}
          >
            <span aria-hidden>{meta.icon}</span>
            {meta.label}
          </span>
          <h3 className="mt-1.5 text-sm font-semibold leading-5 text-stone-800">
            {finding.rule_title ?? finding.rule_id}
          </h3>
          <div className="text-[11px] text-stone-400">
            {finding.citation}
            {finding.severity && ` · ${finding.severity}`}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close inspector"
          className="rounded-md px-2 py-1 text-stone-400 hover:bg-stone-100"
        >
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
        {/* 1. Evidence first */}
        <EvidenceCards finding={finding} onScrollToOffset={onScrollToOffset} />

        {/* 2. Claude's reasoning, clearly attributed */}
        <section>
          <div className="mb-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-stone-400">
            ✦ Claude's assessment
            {evaluatorModel && (
              <span className="rounded-full border border-stone-200 bg-stone-50 px-1.5 py-0.5 normal-case text-stone-500">
                {evaluatorModel.split(" ")[0]}
              </span>
            )}
          </div>
          <p className="leading-6 text-stone-700">{finding.reasoning}</p>
          {finding.evidence_strength && (
            <div className="mt-2 text-[11px] text-stone-500">
              evidence strength:{" "}
              <span className="font-medium">{finding.evidence_strength}</span>
            </div>
          )}
          {finding.status !== "conflicting" && finding.protocol_reference && (
            <p className="mt-2 text-xs text-stone-500">
              Protocol reference: {finding.protocol_reference}
            </p>
          )}
        </section>

        {/* 3. Detail sections — one click away, never one tab away */}
        <details className="rounded-lg border border-stone-200">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-stone-600">
            Retrieval — what was searched &amp; scored
          </summary>
          <RetrievalSection
            evidence={evidence.data ?? null}
            onScrollToOffset={onScrollToOffset}
          />
        </details>

        <details className="rounded-lg border border-stone-200">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-stone-600">
            Citation graph
          </summary>
          <div className="flex h-64 flex-col border-t border-stone-100">
            <Suspense
              fallback={
                <div className="flex flex-1 items-center justify-center text-xs text-stone-400">
                  Loading graph…
                </div>
              }
            >
              <CitationGraphView
                finding={finding}
                evidence={evidence.data ?? null}
                onScrollToOffset={onScrollToOffset}
              />
            </Suspense>
          </div>
        </details>

        <details className="rounded-lg border border-stone-200">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-stone-600">
            Audit trail — recorded, never re-executed
          </summary>
          <div className="flex max-h-96 flex-col overflow-hidden border-t border-stone-100">
            <AuditReplay reviewId={reviewId} findingId={finding.id} />
          </div>
        </details>
      </div>
    </aside>
  );
}

function EvidenceCards({
  finding,
  onScrollToOffset,
}: {
  finding: FindingOut;
  onScrollToOffset: (offset: number) => void;
}) {
  if (finding.status === "not_found") {
    return (
      <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-violet-800">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wide">
          Evidence of absence
        </div>
        Searched and found no relevant evidence:
        <ul className="mt-1 list-inside list-disc text-xs">
          {(finding.queries_executed ?? []).map((q) => (
            <li key={q}>“{q}”</li>
          ))}
        </ul>
      </div>
    );
  }
  if (!finding.verbatim_quote) return null;

  const conflicting = finding.status === "conflicting";
  return (
    <div className="space-y-2">
      <blockquote
        onClick={() => finding.span && onScrollToOffset(finding.span.char_start)}
        className={`cursor-pointer rounded-lg border-l-4 bg-stone-50 px-3 py-2 text-stone-700 ${
          conflicting ? "border-red-300" : "border-stone-300"
        }`}
        title="Click to locate in the document"
      >
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">
          Document says{" "}
          {finding.span && (
            <span className="normal-case">
              (chars {finding.span.char_start}–{finding.span.char_end}, verified)
            </span>
          )}
        </div>
        “{finding.verbatim_quote}”
      </blockquote>
      {conflicting && finding.protocol_reference && (
        <blockquote className="rounded-lg border-l-4 border-sky-300 bg-sky-50/50 px-3 py-2 text-stone-700">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-sky-500">
            Protocol says
          </div>
          {finding.protocol_reference}
        </blockquote>
      )}
    </div>
  );
}

function RetrievalSection({
  evidence,
  onScrollToOffset,
}: {
  evidence: FindingEvidenceOut | null;
  onScrollToOffset: (offset: number) => void;
}) {
  if (!evidence) {
    return (
      <p className="border-t border-stone-100 px-3 py-2 text-xs text-stone-400">
        No retrieval recorded for this finding.
      </p>
    );
  }
  return (
    <div className="space-y-3 border-t border-stone-100 px-3 py-2 text-xs">
      <div className="text-stone-500">
        queries: {evidence.queries_executed.map((q) => `“${q}”`).join(", ")}
        <br />
        fusion:{" "}
        {Object.entries(evidence.fusion_params)
          .map(([k, v]) => `${k}=${v}`)
          .join(" · ")}
        {evidence.embedding_model && ` · embeddings: ${evidence.embedding_model}`}
      </div>
      <table className="w-full text-left">
        <thead className="text-[10px] uppercase text-stone-400">
          <tr>
            <th className="py-1 pr-2 font-medium">rank</th>
            <th className="py-1 pr-2 font-medium">section</th>
            <th className="py-1 pr-2 font-medium">dense</th>
            <th className="py-1 pr-2 font-medium">sparse</th>
            <th className="py-1 pr-2 font-medium">fused</th>
          </tr>
        </thead>
        <tbody className="text-stone-600">
          {evidence.results.map((r) => (
            <tr
              key={r.chunk_id}
              className="cursor-pointer border-t border-stone-100 hover:bg-stone-50"
              onClick={() => r.char_start !== null && onScrollToOffset(r.char_start)}
            >
              <td className="py-1 pr-2">{r.rank}</td>
              <td className="py-1 pr-2">{r.section_title ?? "—"}</td>
              <td className="py-1 pr-2">{r.dense_score?.toFixed(4) ?? "—"}</td>
              <td className="py-1 pr-2">{r.sparse_score?.toFixed(4) ?? "—"}</td>
              <td className="py-1 pr-2">{r.fused_score.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-stone-400">
        Served verbatim from the append-only audit log. “—” means the chunk
        was absent from that retriever's results (absence, not zero relevance).
      </p>
    </div>
  );
}
