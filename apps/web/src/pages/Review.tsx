import { useQuery } from "@tanstack/react-query";
import { Allotment } from "allotment";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { apiGet } from "../api/client";
import type { DocumentText, ReviewOut, RuleSetOut } from "../api/types";
import { CoverageMatrix } from "../components/matrix/CoverageMatrix";
import { VerdictStrip } from "../components/matrix/VerdictStrip";
import { DocumentViewer } from "../components/document/DocumentViewer";
import { SemanticMap } from "../components/document/SemanticMap";
import { Inspector } from "../components/inspector/Inspector";
import { displayName, rulesetName } from "../lib/format";

export function ReviewPage() {
  const { reviewId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("finding");
  const [scrollOffset, setScrollOffset] = useState<{
    offset: number;
    nonce: number;
  } | null>(null);
  const [showMap, setShowMap] = useState(false);

  const review = useQuery({
    queryKey: ["review", reviewId],
    queryFn: () => apiGet<ReviewOut>(`/reviews/${reviewId}`),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "running" ? 1200 : false;
    },
  });

  const ruleset = useQuery({
    queryKey: ["ruleset", review.data?.ruleset_id],
    queryFn: () => apiGet<RuleSetOut>(`/rulesets/${review.data!.ruleset_id}`),
    enabled: !!review.data?.ruleset_id,
    staleTime: Infinity,
  });

  const documentText = useQuery({
    queryKey: ["document-text", review.data?.document_id],
    queryFn: () =>
      apiGet<DocumentText>(`/documents/${review.data!.document_id}/text`),
    enabled: !!review.data?.document_id,
  });

  const select = (findingId: string) =>
    setSearchParams(findingId === selectedId ? {} : { finding: findingId }, {
      replace: true,
    });

  if (review.isError) {
    return (
      <div className="p-8 text-sm text-red-700">
        Failed to load review.{" "}
        <Link to="/" className="underline">
          Back home
        </Link>
      </div>
    );
  }
  if (!review.data || !documentText.data) {
    return <div className="p-8 text-sm text-stone-400">Loading review…</div>;
  }

  const { data } = review;
  const running = data.status === "pending" || data.status === "running";
  const selectedFinding = data.findings.find((f) => f.id === selectedId) ?? null;
  const scrollTo = (offset: number) =>
    setScrollOffset((prev) => ({ offset, nonce: (prev?.nonce ?? 0) + 1 }));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-2">
        <div className="flex min-w-0 items-baseline gap-3">
          <Link to="/" className="text-stone-400 hover:text-stone-600" aria-label="Back">
            ←
          </Link>
          <h2 className="truncate text-sm font-semibold text-stone-800">
            {displayName(documentText.data.filename)}
          </h2>
          <span className="hidden text-[11px] text-stone-400 sm:block">
            {rulesetName(data.ruleset_id)}
          </span>
          {data.evaluator_model && (
            <span
              title="The model that evaluated this review (from the audit log)"
              className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-500"
            >
              {data.evaluator_model.split(" ")[0]}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setShowMap((v) => !v)}
            aria-pressed={showMap}
            className={`rounded-md border px-3 py-1 text-xs font-medium ${
              showMap
                ? "border-stone-800 bg-stone-900 text-white"
                : "border-stone-300 text-stone-600 hover:bg-stone-50"
            }`}
          >
            Semantic map
          </button>
          {data.status === "complete" && (
            <Link
              to={`/reviews/${data.id}/report`}
              className="rounded-md border border-stone-300 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
            >
              Export report
            </Link>
          )}
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              running
                ? "bg-sky-50 text-sky-700"
                : data.status === "complete"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
            }`}
          >
            {running
              ? `Claude reviewing · ${data.findings.length}/${data.rule_count}`
              : data.status}
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <Allotment defaultSizes={[1, 2, 1.2]}>
          <Allotment.Pane minSize={280} preferredSize={330}>
            <div className="flex h-full flex-col">
              {data.status === "complete" && (
                <VerdictStrip
                  findings={data.findings}
                  ruleCount={data.rule_count}
                />
              )}
              <div className="min-h-0 flex-1">
                <CoverageMatrix
                  rules={ruleset.data?.rules ?? []}
                  findings={data.findings}
                  running={running}
                  selectedId={selectedId}
                  onSelect={select}
                />
              </div>
            </div>
          </Allotment.Pane>
          <Allotment.Pane minSize={380}>
            <div className="relative h-full">
              {showMap && (
                <SemanticMap
                  documentId={data.document_id}
                  findings={data.findings}
                  selectedId={selectedId}
                  onScrollToOffset={scrollTo}
                  onClose={() => setShowMap(false)}
                />
              )}
              <DocumentViewer
                text={documentText.data.canonical_text}
                findings={data.findings}
                selectedId={selectedId}
                onSelect={select}
                scrollOffset={scrollOffset}
              />
            </div>
          </Allotment.Pane>
          <Allotment.Pane
            visible={!!selectedFinding}
            preferredSize={380}
            minSize={300}
            snap
          >
            {selectedFinding ? (
              <Inspector
                reviewId={data.id}
                finding={selectedFinding}
                evaluatorModel={data.evaluator_model}
                onClose={() => select(selectedFinding.id)}
                onScrollToOffset={scrollTo}
              />
            ) : (
              <div />
            )}
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  );
}
