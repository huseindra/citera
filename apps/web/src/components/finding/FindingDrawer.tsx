import { useQuery } from "@tanstack/react-query";
import { Suspense, lazy, useState } from "react";
import { apiGet } from "../../api/client";
import type { FindingEvidenceOut, FindingOut } from "../../api/types";
import { STATUS_META } from "../../lib/status";
import { AuditReplay } from "./AuditReplay";

// React Flow is heavy — load it only when the graph tab is opened
const CitationGraphView = lazy(() =>
  import("./CitationGraph").then((m) => ({ default: m.CitationGraphView })),
);

interface Props {
  reviewId: string;
  finding: FindingOut;
  evaluatorModel: string | null;
  onClose: () => void;
  onScrollToOffset: (offset: number) => void;
}

type Tab = "evidence" | "graph" | "audit";

const TAB_LABELS: Record<Tab, string> = {
  evidence: "Evidence",
  graph: "Citation graph",
  audit: "Audit replay",
};

export function FindingDrawer({
  reviewId,
  finding,
  evaluatorModel,
  onClose,
  onScrollToOffset,
}: Props) {
  const [tab, setTab] = useState<Tab>("evidence");
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
    <div className="flex h-full flex-col border-t border-stone-200 bg-white">
      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.chip}`}
          >
            <span aria-hidden>{meta.icon}</span>
            {meta.label}
          </span>
          <span className="text-sm font-medium text-stone-800">
            {finding.rule_title ?? finding.rule_id}
          </span>
          <span className="text-xs text-stone-500">{finding.citation}</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1 font-medium ${
                tab === t
                  ? "bg-stone-900 text-white"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
          <button
            onClick={onClose}
            aria-label="Close finding panel"
            className="ml-2 rounded-md px-2 py-1 text-stone-400 hover:bg-stone-100"
          >
            ✕
          </button>
        </div>
      </div>

      {tab === "evidence" ? (
        <EvidenceTab
          finding={finding}
          evidence={evidence.data ?? null}
          evaluatorModel={evaluatorModel}
          onScrollToOffset={onScrollToOffset}
        />
      ) : tab === "graph" ? (
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
      ) : (
        <AuditReplay reviewId={reviewId} findingId={finding.id} />
      )}
    </div>
  );
}

/** Reviewer layer first (evidence → regulation → reasoning), audit layer
 *  collapsed below — the two-layer explainability decision. */
function EvidenceTab({
  finding,
  evidence,
  evaluatorModel,
  onScrollToOffset,
}: {
  finding: FindingOut;
  evidence: FindingEvidenceOut | null;
  evaluatorModel: string | null;
  onScrollToOffset: (offset: number) => void;
}) {
  const conflicting = finding.status === "conflicting";
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 text-sm">
      {/* 1. Evidence before conclusions */}
      {finding.verbatim_quote ? (
        <div className={conflicting ? "grid grid-cols-2 gap-3" : ""}>
          <blockquote
            onClick={() =>
              finding.span && onScrollToOffset(finding.span.char_start)
            }
            className={`cursor-pointer rounded-md border-l-4 bg-stone-50 px-3 py-2 text-stone-700 ${
              conflicting ? "border-red-300" : "border-stone-300"
            }`}
            title="Click to locate in the document"
          >
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">
              Document says
            </div>
            “{finding.verbatim_quote}”
          </blockquote>
          {conflicting && finding.protocol_reference && (
            <blockquote className="rounded-md border-l-4 border-sky-300 bg-sky-50/50 px-3 py-2 text-stone-700">
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-sky-500">
                Protocol says
              </div>
              {finding.protocol_reference}
            </blockquote>
          )}
        </div>
      ) : finding.status === "not_found" ? (
        <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-violet-800">
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
      ) : null}

      {/* 2. The regulation */}
      <div className="text-xs text-stone-500">
        <span className="font-medium text-stone-600">{finding.citation}</span>
        {finding.severity && ` · severity: ${finding.severity}`}
        {finding.evidence_strength &&
          ` · evidence strength: ${finding.evidence_strength}`}
      </div>

      {/* 3. The AI's reasoning — after the evidence, clearly attributed */}
      <div>
        <div className="mb-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-stone-400">
          Claude's assessment
          {evaluatorModel && (
            <span className="rounded-full border border-stone-200 bg-stone-50 px-1.5 py-0.5 normal-case text-stone-500">
              {evaluatorModel.split(" ")[0]}
            </span>
          )}
        </div>
        <p className="leading-6 text-stone-700">{finding.reasoning}</p>
      </div>
      {!conflicting && finding.protocol_reference && (
        <p className="text-xs text-stone-500">
          Protocol reference: {finding.protocol_reference}
        </p>
      )}

      {/* Audit layer — progressive disclosure */}
      <details className="rounded-md border border-stone-200">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-stone-600">
          Audit layer — retrieval scores &amp; parameters
        </summary>
        {evidence ? (
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
                    onClick={() =>
                      r.char_start !== null && onScrollToOffset(r.char_start)
                    }
                  >
                    <td className="py-1 pr-2">{r.rank}</td>
                    <td className="py-1 pr-2">{r.section_title ?? "—"}</td>
                    <td className="py-1 pr-2">
                      {r.dense_score?.toFixed(4) ?? "—"}
                    </td>
                    <td className="py-1 pr-2">
                      {r.sparse_score?.toFixed(4) ?? "—"}
                    </td>
                    <td className="py-1 pr-2">{r.fused_score.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-stone-400">
              Served verbatim from the append-only audit log. “—” means the
              chunk was absent from that retriever's results (absence, not
              zero relevance).
            </p>
          </div>
        ) : (
          <p className="px-3 py-2 text-xs text-stone-400">
            No retrieval recorded for this finding.
          </p>
        )}
      </details>
    </div>
  );
}
