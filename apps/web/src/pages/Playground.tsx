import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState, type DragEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiGet, apiPost, apiUploadWithProgress } from "../api/client";
import type { DocumentOut, ReviewOut, ReviewSummary } from "../api/types";
import { displayName, rulesetName, timeAgo } from "../lib/format";
import { STATUS_META } from "../lib/status";

type SlotKind = "protocol" | "icf";

interface Slot {
  documentId: string | null;
  filename: string | null;
  state: "empty" | "uploading" | "processing" | "ready" | "failed";
  progress?: number;
  sizeKb?: number;
  error?: string;
}

const EMPTY_SLOT: Slot = { documentId: null, filename: null, state: "empty" };

export function PlaygroundPage() {
  const navigate = useNavigate();
  const [slots, setSlots] = useState<Record<SlotKind, Slot>>({
    protocol: EMPTY_SLOT,
    icf: EMPTY_SLOT,
  });

  const documents = useQuery({
    queryKey: ["documents"],
    queryFn: () => apiGet<DocumentOut[]>("/documents"),
    // poll while a slot is still chunking in the background
    refetchInterval: () =>
      Object.values(slots).some((s) => s.state === "processing") ? 1200 : false,
  });

  // promote processing slots once the poll sees a terminal document state
  // (an effect, never render-time state updates)
  const docs = documents.data;
  useEffect(() => {
    if (!docs) return;
    const docById = new Map(docs.map((d) => [d.id, d]));
    setSlots((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const kind of ["protocol", "icf"] as SlotKind[]) {
        const slot = prev[kind];
        if (slot.state !== "processing" || !slot.documentId) continue;
        const doc = docById.get(slot.documentId);
        if (doc?.status === "ready") {
          next[kind] = { ...slot, state: "ready" };
          changed = true;
        } else if (doc?.status === "failed") {
          next[kind] = {
            ...slot,
            state: "failed",
            error: doc.status_reason ?? "",
          };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [docs]);

  const reviews = useQuery({
    queryKey: ["reviews"],
    queryFn: () => apiGet<ReviewSummary[]>("/reviews"),
  });

  const upload = useCallback(async (kind: SlotKind, file: File) => {
    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    setSlots((prev) => ({
      ...prev,
      [kind]: {
        documentId: null,
        filename: file.name,
        state: "uploading",
        progress: 0,
        sizeKb,
      },
    }));
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      const doc = await apiUploadWithProgress<DocumentOut>(
        "/documents",
        form,
        (percent) =>
          setSlots((prev) => ({
            ...prev,
            [kind]: { ...prev[kind], progress: percent },
          })),
      );
      setSlots((prev) => ({
        ...prev,
        [kind]: {
          documentId: doc.id,
          filename: doc.filename,
          state: doc.status === "ready" ? "ready" : "processing",
          sizeKb,
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
    mutationFn: (body: { document_id: string; protocol_document_id: string }) =>
      apiPost<ReviewOut>("/reviews", body),
    onSuccess: (review) => navigate(`/playground/reviews/${review.id}`),
  });

  const readyDocs = (documents.data ?? []).filter((d) => d.status === "ready");
  const canStart =
    slots.protocol.state === "ready" && slots.icf.state === "ready";
  const latestComplete = (reviews.data ?? []).find((r) => r.status === "complete");

  return (
    <div className="mx-auto max-w-3xl px-6 pb-16 pt-10">
      {/* Playground framing: this is the SDK, demonstrated */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-stone-400">
          <span aria-hidden>⚡</span> Interactive Playground
        </div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-stone-900">
          Evidence-verified clinical review, live
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-stone-500">
          Every action below is an SDK call — upload documents, run a
          review, inspect verified findings. Ready to embed it?{" "}
          <Link to="/keys" className="font-medium text-stone-700 underline">
            Get an API key
          </Link>
          .
        </p>
        <details className="mt-3 max-w-xl">
          <summary className="cursor-pointer text-xs font-medium text-stone-500">
            View the equivalent SDK code
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-stone-900 p-3 text-[11px] leading-5 text-stone-100">
{`const protocol = await citera.documents.upload({ file, kind: "protocol" });
const icf      = await citera.documents.upload({ file, kind: "icf" });
const review   = await citera.reviews.create({
  document: icf.id, protocol: protocol.id, ruleset: "fda-21cfr50",
});
const result = await citera.reviews.waitUntilComplete(review.id);`}
          </pre>
        </details>
        {latestComplete && (
          <Link
            to={`/playground/reviews/${latestComplete.id}`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-stone-400"
          >
            Open the latest review
            <span aria-hidden>→</span>
          </Link>
        )}
      </div>

      {/* New review wizard */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-stone-800">New review</h2>
          <span className="text-[11px] text-stone-400">
            {rulesetName("fda-21cfr50")}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DropZone
            kind="protocol"
            title="Study protocol"
            hint="the source of truth"
            slot={slots.protocol}
            onFile={upload}
            existing={readyDocs.filter((d) => d.kind === "protocol")}
            onPick={(doc) =>
              setSlots((prev) => ({
                ...prev,
                protocol: { documentId: doc.id, filename: doc.filename, state: "ready" },
              }))
            }
          />
          <DropZone
            kind="icf"
            title="Consent form (ICF)"
            hint="the document under review"
            slot={slots.icf}
            onFile={upload}
            existing={readyDocs.filter((d) => d.kind === "icf")}
            onPick={(doc) =>
              setSlots((prev) => ({
                ...prev,
                icf: { documentId: doc.id, filename: doc.filename, state: "ready" },
              }))
            }
          />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[11px] text-stone-400">
            Markdown, text, PDF or DOCX (synthetic documents only — no real
            clinical data).
          </p>
          <button
            disabled={!canStart || startReview.isPending}
            onClick={() =>
              startReview.mutate({
                document_id: slots.icf.documentId!,
                protocol_document_id: slots.protocol.documentId!,
              })
            }
            className="rounded-lg bg-stone-900 px-4 py-2 text-xs font-semibold text-white transition-opacity disabled:opacity-30"
          >
            {startReview.isPending ? "Starting…" : "Start review"}
          </button>
        </div>
        {startReview.isError && (
          <p className="mt-2 text-xs text-red-700">
            {(startReview.error as Error).message}
          </p>
        )}
      </section>

      {/* Past reviews */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold text-stone-800">Reviews</h2>
        <ul className="mt-3 divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {(reviews.data ?? []).map((r) => (
            <li key={r.id}>
              <Link
                to={`/playground/reviews/${r.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-stone-50"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-stone-800">
                    {displayName(r.document_filename)}
                  </div>
                  <div className="text-[11px] text-stone-400">
                    {rulesetName(r.ruleset_id)} · {timeAgo(r.created_at)}
                  </div>
                </div>
                <StatusChips counts={r.status_counts} status={r.status} />
              </Link>
            </li>
          ))}
          {reviews.data?.length === 0 && (
            <li className="px-4 py-6 text-center text-xs text-stone-400">
              No reviews yet — start one above, or run <code>make seed</code>{" "}
              for the demo corpus.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

function StatusChips({
  counts,
  status,
}: {
  counts: Record<string, number>;
  status: string;
}) {
  if (status !== "complete") {
    return (
      <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-medium text-sky-700">
        {status}
      </span>
    );
  }
  const order = ["conflicting", "not_found", "partial", "evaluation_failed", "satisfied"];
  return (
    <div className="flex shrink-0 items-center gap-1">
      {order
        .filter((s) => counts[s])
        .map((s) => (
          <span
            key={s}
            title={STATUS_META[s as keyof typeof STATUS_META].label}
            className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] font-medium ${STATUS_META[s as keyof typeof STATUS_META].chip}`}
          >
            <span aria-hidden>{STATUS_META[s as keyof typeof STATUS_META].icon}</span>
            {counts[s]}
          </span>
        ))}
    </div>
  );
}

function DropZone({
  kind,
  title,
  hint,
  slot,
  onFile,
  existing,
  onPick,
}: {
  kind: SlotKind;
  title: string;
  hint: string;
  slot: Slot;
  onFile: (kind: SlotKind, file: File) => void;
  existing: DocumentOut[];
  onPick: (doc: DocumentOut) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(kind, file);
  };

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors ${
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
        <div className="text-xs font-semibold text-stone-700">{title}</div>
        <div className="mt-0.5 text-[11px] text-stone-400">{hint}</div>
        <div className="mt-2 w-full text-[11px]">
          {slot.state === "empty" && (
            <span className="text-stone-400">drop a file or click</span>
          )}
          {slot.state === "uploading" && (
            <div className="mx-auto max-w-40">
              <div className="text-sky-600">
                uploading {slot.progress ?? 0}%
                {slot.sizeKb ? ` · ${slot.sizeKb} KB` : ""}
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-sky-100">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all"
                  style={{ width: `${slot.progress ?? 0}%` }}
                />
              </div>
            </div>
          )}
          {slot.state === "processing" && (
            <div className="mx-auto max-w-40">
              <div className="text-sky-600">indexing evidence…</div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-sky-100">
                <div className="theater-shimmer h-full w-1/3 rounded-full bg-sky-400" />
              </div>
            </div>
          )}
          {slot.state === "ready" && (
            <span className="font-medium text-emerald-700">
              ✓ {displayName(slot.filename)}
              {slot.sizeKb ? (
                <span className="font-normal text-stone-400"> · {slot.sizeKb} KB</span>
              ) : null}
            </span>
          )}
          {slot.state === "failed" && (
            <span className="text-red-600">failed — {slot.error}</span>
          )}
        </div>
      </label>
      {existing.length > 0 && slot.state !== "ready" && (
        <select
          value=""
          onChange={(e) => {
            const doc = existing.find((d) => d.id === e.target.value);
            if (doc) onPick(doc);
          }}
          className="mt-1.5 w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-500"
        >
          <option value="">…or pick an uploaded document</option>
          {existing.map((d) => (
            <option key={d.id} value={d.id}>
              {displayName(d.filename)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
