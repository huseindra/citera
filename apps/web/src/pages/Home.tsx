import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiGet, apiPost, apiUpload } from "../api/client";
import type { DocumentOut, ReviewOut, ReviewSummary } from "../api/types";

export function HomePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const documents = useQuery({
    queryKey: ["documents"],
    queryFn: () => apiGet<DocumentOut[]>("/documents"),
  });
  const reviews = useQuery({
    queryKey: ["reviews"],
    queryFn: () => apiGet<ReviewSummary[]>("/reviews"),
  });

  const upload = useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: string }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      return apiUpload<DocumentOut>("/documents", form);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });

  const startReview = useMutation({
    mutationFn: (body: { document_id: string; protocol_document_id: string }) =>
      apiPost<ReviewOut>("/reviews", body),
    onSuccess: (review) => navigate(`/reviews/${review.id}`),
  });

  const [icfId, setIcfId] = useState("");
  const [protocolId, setProtocolId] = useState("");

  const ready = (documents.data ?? []).filter((d) => d.status === "ready");
  const icfs = ready.filter((d) => d.kind !== "protocol");
  const protocols = ready.filter((d) => d.kind === "protocol");

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-6 py-10">
      <section>
        <h2 className="text-sm font-semibold text-stone-800">Documents</h2>
        <p className="mt-1 text-xs text-stone-500">
          Upload the study protocol and the consent form to review
          (markdown/text; synthetic documents only).
        </p>
        <form
          className="mt-3 flex items-center gap-2 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fileInput = form.elements.namedItem("file") as HTMLInputElement;
            const kindInput = form.elements.namedItem("kind") as HTMLSelectElement;
            const file = fileInput.files?.[0];
            if (file) {
              upload.mutate({ file, kind: kindInput.value });
              form.reset();
            }
          }}
        >
          <input
            name="file"
            type="file"
            accept=".md,.markdown,.txt,.pdf"
            required
            className="text-xs text-stone-600 file:mr-2 file:rounded-md file:border file:border-stone-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-stone-700"
          />
          <select
            name="kind"
            className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs"
            defaultValue="icf"
          >
            <option value="icf">ICF</option>
            <option value="protocol">Protocol</option>
            <option value="other">Other</option>
          </select>
          <button
            type="submit"
            disabled={upload.isPending}
            className="rounded-md bg-stone-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {upload.isPending ? "Uploading…" : "Upload"}
          </button>
        </form>
        {upload.isError && (
          <p className="mt-2 text-xs text-red-700">
            {(upload.error as Error).message}
          </p>
        )}
        <ul className="mt-4 divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
          {(documents.data ?? []).map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between px-4 py-2 text-sm"
            >
              <div>
                <span className="text-stone-800">{d.filename}</span>
                <span className="ml-2 text-xs uppercase text-stone-400">
                  {d.kind}
                </span>
              </div>
              <span className="text-xs text-stone-500">
                {d.status === "ready"
                  ? `${d.chunk_count} chunks`
                  : d.status === "failed"
                    ? `failed: ${d.status_reason}`
                    : d.status}
              </span>
            </li>
          ))}
          {documents.data?.length === 0 && (
            <li className="px-4 py-3 text-xs text-stone-400">
              No documents yet.
            </li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-stone-800">Run a review</h2>
        <div className="mt-3 flex items-center gap-2 text-xs">
          <select
            value={icfId}
            onChange={(e) => setIcfId(e.target.value)}
            className="min-w-44 rounded-md border border-stone-300 bg-white px-2 py-1.5"
          >
            <option value="">Consent form…</option>
            {icfs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.filename}
              </option>
            ))}
          </select>
          <span className="text-stone-400">validated against</span>
          <select
            value={protocolId}
            onChange={(e) => setProtocolId(e.target.value)}
            className="min-w-44 rounded-md border border-stone-300 bg-white px-2 py-1.5"
          >
            <option value="">Protocol…</option>
            {protocols.map((d) => (
              <option key={d.id} value={d.id}>
                {d.filename}
              </option>
            ))}
          </select>
          <button
            disabled={!icfId || !protocolId || startReview.isPending}
            onClick={() =>
              startReview.mutate({
                document_id: icfId,
                protocol_document_id: protocolId,
              })
            }
            className="rounded-md bg-stone-900 px-3 py-1.5 font-medium text-white disabled:opacity-40"
          >
            {startReview.isPending ? "Starting…" : "Review (FDA 21 CFR 50.25)"}
          </button>
        </div>
        {startReview.isError && (
          <p className="mt-2 text-xs text-red-700">
            {(startReview.error as Error).message}
          </p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-stone-800">Reviews</h2>
        <ul className="mt-3 divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
          {(reviews.data ?? []).map((r) => (
            <li key={r.id}>
              <Link
                to={`/reviews/${r.id}`}
                className="flex items-center justify-between px-4 py-2 text-sm hover:bg-stone-50"
              >
                <span className="text-stone-800">
                  {r.document_filename ?? r.document_id}
                </span>
                <span className="text-xs text-stone-500">
                  {r.ruleset_id} · {r.status}
                </span>
              </Link>
            </li>
          ))}
          {reviews.data?.length === 0 && (
            <li className="px-4 py-3 text-xs text-stone-400">
              No reviews yet.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
