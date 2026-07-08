import { useQuery } from "@tanstack/react-query";
import { Allotment } from "allotment";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { apiGet } from "../api/client";
import type { DocumentText, ReviewOut } from "../api/types";
import { CoverageMatrix } from "../components/matrix/CoverageMatrix";
import { DocumentViewer } from "../components/document/DocumentViewer";

export function ReviewPage() {
  const { reviewId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("finding");

  const review = useQuery({
    queryKey: ["review", reviewId],
    queryFn: () => apiGet<ReviewOut>(`/reviews/${reviewId}`),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "running" ? 1500 : false;
    },
  });

  const documentText = useQuery({
    queryKey: ["document-text", review.data?.document_id],
    queryFn: () =>
      apiGet<DocumentText>(`/documents/${review.data!.document_id}/text`),
    enabled: !!review.data?.document_id,
  });

  const select = (findingId: string) =>
    setSearchParams(
      findingId === selectedId ? {} : { finding: findingId },
      { replace: true },
    );

  if (review.isError) {
    return (
      <div className="p-8 text-sm text-red-700">
        Failed to load review.{" "}
        <Link to="/" className="underline">
          Back to documents
        </Link>
      </div>
    );
  }
  if (!review.data || !documentText.data) {
    return <div className="p-8 text-sm text-stone-500">Loading review…</div>;
  }

  const { data } = review;
  const running = data.status === "pending" || data.status === "running";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-2">
        <div className="flex items-baseline gap-3">
          <h2 className="text-sm font-semibold text-stone-800">
            {documentText.data.filename}
          </h2>
          <span className="text-xs text-stone-500">
            {data.ruleset_id} v{data.ruleset_version}
          </span>
        </div>
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
            ? `reviewing… ${data.findings.length}/${data.rule_count}`
            : data.status}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <Allotment defaultSizes={[1, 2]}>
          <Allotment.Pane minSize={320}>
            <CoverageMatrix
              findings={data.findings}
              selectedId={selectedId}
              onSelect={select}
            />
          </Allotment.Pane>
          <Allotment.Pane minSize={400}>
            <DocumentViewer
              text={documentText.data.canonical_text}
              findings={data.findings}
              selectedId={selectedId}
              onSelect={select}
            />
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  );
}
