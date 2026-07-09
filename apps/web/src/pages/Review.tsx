import { useQuery } from "@tanstack/react-query";
import { Allotment } from "allotment";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Play, Square } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { apiGet } from "../api/client";
import type { DocumentText, ReviewOut, RuleSetOut } from "../api/types";
import { CoverageMatrix } from "../components/matrix/CoverageMatrix";
import { VerdictStrip } from "../components/matrix/VerdictStrip";
import { DocumentViewer } from "../components/document/DocumentViewer";
import { Inspector } from "../components/inspector/Inspector";
import { EvidenceCoverage } from "../components/review/EvidenceCoverage";
import { RulesetBadge } from "../components/RulesetBadge";
import { displayName, rulesetName } from "../lib/format";

export function ReviewPage() {
  const { reviewId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("finding");
  const [scrollOffset, setScrollOffset] = useState<{
    offset: number;
    nonce: number;
  } | null>(null);
  const [showCoverage, setShowCoverage] = useState(false);
  // playback: re-animate a completed review, one finding per beat
  const [playbackIndex, setPlaybackIndex] = useState<number | null>(null);

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

  // depend on the COUNT, not the data object — a background refetch must
  // not reset the playback timer
  const totalFindings = review.data?.findings.length ?? 0;
  useEffect(() => {
    if (playbackIndex === null || totalFindings === 0) return;
    if (playbackIndex >= totalFindings) {
      const done = setTimeout(() => setPlaybackIndex(null), 700);
      return () => clearTimeout(done);
    }
    const tick = setTimeout(() => setPlaybackIndex((i) => (i ?? 0) + 1), 850);
    return () => clearTimeout(tick);
  }, [playbackIndex, totalFindings]);

  // ALL hooks must live above the early returns (Rules of Hooks) — this
  // useMemo previously sat below them and crashed every review page the
  // moment data finished loading.
  const findings = review.data?.findings;
  const orderedFindings = useMemo(
    () =>
      [...(findings ?? [])].sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      ),
    [findings],
  );

  if (review.isError) {
    return (
      <div className="p-8 text-sm text-red-700">
        Failed to load review.{" "}
        <Link to="/playground" className="underline">
          Back home
        </Link>
      </div>
    );
  }
  if (!review.data || !documentText.data) {
    return <div className="p-8 text-sm text-stone-400">Loading review…</div>;
  }

  const { data } = review;
  const reviewRunning = data.status === "pending" || data.status === "running";
  const playing = playbackIndex !== null;
  const running = reviewRunning || playing;
  const selectedFinding = data.findings.find((f) => f.id === selectedId) ?? null;
  const scrollTo = (offset: number) =>
    setScrollOffset((prev) => ({ offset, nonce: (prev?.nonce ?? 0) + 1 }));

  const visibleFindings = playing
    ? orderedFindings.slice(0, playbackIndex)
    : data.findings;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-2">
        <div className="flex min-w-0 items-baseline gap-3">
          <Link to="/playground" className="text-stone-400 hover:text-stone-600" aria-label="Back">
            <ArrowLeft aria-hidden className="h-4 w-4" />
          </Link>
          <h2 className="truncate text-sm font-semibold text-stone-800">
            {displayName(documentText.data.filename)}
          </h2>
          <span className="hidden sm:block">
            <RulesetBadge
              rulesetId={data.ruleset_id}
              label={rulesetName(data.ruleset_id)}
            />
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setShowCoverage((v) => !v)}
            aria-pressed={showCoverage}
            className={`rounded-md border px-3 py-1 text-xs font-medium ${
              showCoverage
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-stone-300 text-stone-600 hover:bg-stone-50"
            }`}
          >
            Regulatory Readiness
          </button>
          {data.status === "complete" && (
            <>
              <button
                onClick={() =>
                  playing ? setPlaybackIndex(null) : setPlaybackIndex(0)
                }
                title="Re-animate this review, finding by finding"
                className={`rounded-md border px-3 py-1 text-xs font-medium ${
                  playing
                    ? "border-sky-500 bg-sky-50 text-sky-700"
                    : "border-stone-300 text-stone-600 hover:bg-stone-50"
                }`}
              >
                {playing ? (
                  <span className="inline-flex items-center gap-1"><Square aria-hidden className="h-3 w-3" /> Stop</span>
                ) : (
                  <span className="inline-flex items-center gap-1"><Play aria-hidden className="h-3 w-3" /> Replay</span>
                )}
              </button>
              <Link
                to={`/playground/reviews/${data.id}/report`}
                className="rounded-lg border border-stone-300 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
              >
                Export report
              </Link>
            </>
          )}
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              running
                ? "bg-sky-50 text-sky-700"
                : data.status === "complete"
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
            }`}
          >
            {playing
              ? `Replaying · ${visibleFindings.length}/${data.rule_count}`
              : reviewRunning
                ? `Claude reviewing · ${data.findings.length}/${data.rule_count}`
                : data.status}
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <Allotment defaultSizes={[1, 2, 1.2]}>
          <Allotment.Pane minSize={280} preferredSize={330}>
            <div className="flex h-full flex-col">
              {data.status === "complete" && !playing && (
                <VerdictStrip
                  findings={data.findings}
                  ruleCount={data.rule_count}
                />
              )}
              <div className="min-h-0 flex-1">
                <CoverageMatrix
                  rules={ruleset.data?.rules ?? []}
                  findings={visibleFindings}
                  running={running}
                  selectedId={selectedId}
                  onSelect={select}
                />
              </div>
            </div>
          </Allotment.Pane>
          <Allotment.Pane minSize={380}>
            <div className="relative h-full">
              {showCoverage && (
                <EvidenceCoverage
                  rules={ruleset.data?.rules ?? []}
                  findings={data.findings}
                  onSelect={(id) => {
                    if (id !== selectedId) select(id);
                  }}
                  onClose={() => setShowCoverage(false)}
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
                rulesetId={data.ruleset_id}
                finding={selectedFinding}
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
