// Staged reviewer workflow on the report page: Review 1..N passes over an
// immutable AI review, then the Verified digital stamp. Every action is a
// POST that lands in the append-only audit log — this UI never mutates a
// finding, it appends determinations and renders the latest state.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BadgeCheck, CircleDot, FilePlus2, Stamp } from "lucide-react";
import { apiPost } from "../../api/client";
import type {
  DeterminationOut,
  RuleOut,
  StageOut,
  WorkflowOut,
} from "../../api/types";

export function openStage(workflow: WorkflowOut): StageOut | null {
  return workflow.stages.find((s) => s.status === "in_progress") ?? null;
}

/** Latest determination per finding within one stage — earlier rows are
 *  that stage's change history. */
export function latestByFinding(
  stage: StageOut,
): Map<string, DeterminationOut> {
  const latest = new Map<string, DeterminationOut>();
  for (const det of stage.determinations) latest.set(det.finding_id, det);
  return latest;
}

function useWorkflowMutation<TBody>(reviewId: string, path: (body: TBody) => string, body: (b: TBody) => unknown) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (b: TBody) => apiPost<WorkflowOut>(path(b), body(b)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["workflow", reviewId] }),
  });
}

export function WorkflowPanel({
  reviewId,
  workflow,
}: {
  reviewId: string;
  workflow: WorkflowOut;
}) {
  const [reviewerName, setReviewerName] = useState("");
  const [stageNotes, setStageNotes] = useState("");
  const open = openStage(workflow);
  const approved = workflow.approval !== null;
  const readyToStamp =
    !approved && !open && workflow.completed_stages >= workflow.required_stages;
  const canStartStage =
    !approved && !open && workflow.review_status === "complete";

  const start = useWorkflowMutation<string>(
    reviewId,
    () => `/reviews/${reviewId}/stages`,
    (name) => ({ reviewer_name: name }),
  );
  const complete = useWorkflowMutation<string>(
    reviewId,
    (stageId) => `/reviews/${reviewId}/stages/${stageId}/complete`,
    () => ({ notes: stageNotes.trim() || null }),
  );
  const approve = useWorkflowMutation<string>(
    reviewId,
    () => `/reviews/${reviewId}/approval`,
    (name) => ({ reviewer_name: name }),
  );
  const error = start.error ?? complete.error ?? approve.error;

  return (
    <section className="mt-6 rounded-lg border border-stone-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Reviewer workflow</h2>
        {approved ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
            <BadgeCheck aria-hidden className="h-3.5 w-3.5" /> Verified
          </span>
        ) : (
          <span className="text-[11px] text-stone-500">
            {workflow.completed_stages} of {workflow.required_stages} review
            stages completed
          </span>
        )}
      </div>

      {/* stage timeline */}
      <ol className="mt-3 space-y-1.5">
        {workflow.stages.map((stage) => (
          <li
            key={stage.id}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px]"
          >
            <span className="font-medium text-stone-800">
              Review {stage.stage_number}
            </span>
            <span className="text-stone-500">{stage.reviewer_name}</span>
            {stage.status === "completed" ? (
              <span className="text-stone-400">
                completed{" "}
                {stage.completed_at &&
                  new Date(stage.completed_at).toLocaleString()}
                {" · "}
                {stage.determinations.length} determination
                {stage.determinations.length === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-sky-700">
                <CircleDot aria-hidden className="h-3 w-3" /> in progress
              </span>
            )}
            {stage.notes && (
              <span className="w-full text-stone-500">“{stage.notes}”</span>
            )}
          </li>
        ))}
        {workflow.stages.length === 0 && (
          <li className="text-[12px] text-stone-400">
            No review stages yet — Review 1 starts the staged sign-off.
          </li>
        )}
      </ol>

      {/* actions (screen only — the printed report shows outcomes) */}
      <div className="mt-3 border-t border-dashed border-stone-200 pt-3 print:hidden">
        {approved ? (
          <p className="text-[11px] text-stone-500">
            Digitally stamped by{" "}
            <span className="font-medium text-stone-700">
              {workflow.approval!.reviewer_name}
            </span>{" "}
            on {new Date(workflow.approval!.created_at).toLocaleString()} —
            workflow closed.
          </p>
        ) : open ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={stageNotes}
              onChange={(e) => setStageNotes(e.target.value)}
              placeholder={`Review ${open.stage_number} notes (optional)`}
              className="min-w-48 flex-1 rounded-md border border-stone-300 px-2 py-1.5 text-xs"
            />
            <button
              onClick={() => complete.mutate(open.id)}
              disabled={complete.isPending}
              className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-900 disabled:opacity-50"
            >
              Complete Review {open.stage_number}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              placeholder="Reviewer name"
              className="min-w-48 flex-1 rounded-md border border-stone-300 px-2 py-1.5 text-xs"
            />
            {canStartStage && (
              <button
                onClick={() =>
                  reviewerName.trim() && start.mutate(reviewerName.trim())
                }
                disabled={!reviewerName.trim() || start.isPending}
                className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-900 disabled:opacity-50"
              >
                Start Review {workflow.stages.length + 1}
              </button>
            )}
            {readyToStamp && (
              <button
                onClick={() =>
                  reviewerName.trim() && approve.mutate(reviewerName.trim())
                }
                disabled={!reviewerName.trim() || approve.isPending}
                className="inline-flex items-center gap-1 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-50"
              >
                <Stamp aria-hidden className="h-3.5 w-3.5" /> Stamp as Verified
              </button>
            )}
          </div>
        )}
        {error && (
          <p className="mt-2 text-[11px] text-red-600">
            {(error as Error).message}
          </p>
        )}
      </div>
    </section>
  );
}

/** Reviewer-authored finding the engine missed: a new appended row —
 *  its quote is grounded server-side against the reviewed document. */
export function AddFindingCard({
  reviewId,
  workflow,
  rules,
}: {
  reviewId: string;
  workflow: WorkflowOut;
  rules: RuleOut[];
}) {
  const open = openStage(workflow);
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [ruleId, setRuleId] = useState("");
  const [status, setStatus] = useState("partial");
  const [reasoning, setReasoning] = useState("");
  const [quote, setQuote] = useState("");

  const submit = useMutation({
    mutationFn: () =>
      apiPost(`/reviews/${reviewId}/stages/${open!.id}/findings`, {
        rule_id: ruleId,
        status,
        reasoning: reasoning.trim(),
        verbatim_quote: quote.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", reviewId] });
      queryClient.invalidateQueries({ queryKey: ["review", reviewId] });
      setExpanded(false);
      setRuleId("");
      setReasoning("");
      setQuote("");
    },
  });

  if (!open) return null;

  return (
    <section className="mt-4 rounded-lg border border-dashed border-stone-300 p-4 print:hidden">
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900"
        >
          <FilePlus2 aria-hidden className="h-3.5 w-3.5" /> Add finding —
          something the engine missed (Review {open.stage_number})
        </button>
      ) : (
        <div className="space-y-2 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-800">
              New reviewer finding — Review {open.stage_number} ·{" "}
              {open.reviewer_name}
            </span>
            <button
              onClick={() => setExpanded(false)}
              className="text-stone-400 hover:text-stone-700"
            >
              Cancel
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={ruleId}
              onChange={(e) => setRuleId(e.target.value)}
              className="min-w-64 flex-1 rounded-md border border-stone-300 px-2 py-1.5"
            >
              <option value="">Requirement…</option>
              {rules.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.citation} — {r.title}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-md border border-stone-300 px-2 py-1.5"
            >
              <option value="partial">Partial</option>
              <option value="conflicting">Conflicting</option>
              <option value="not_found">Missing</option>
              <option value="satisfied">Satisfied</option>
            </select>
          </div>
          <textarea
            value={reasoning}
            onChange={(e) => setReasoning(e.target.value)}
            placeholder="Why does this requirement need attention? (required)"
            rows={2}
            className="w-full rounded-md border border-stone-300 px-2 py-1.5"
          />
          <textarea
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder="Evidence quote — paste the exact document text (optional; verified verbatim against the source)"
            rows={2}
            className="w-full rounded-md border border-stone-300 px-2 py-1.5 font-mono text-[10px]"
          />
          <button
            onClick={() => submit.mutate()}
            disabled={submit.isPending || !ruleId || !reasoning.trim()}
            className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-900 disabled:opacity-50"
          >
            Add finding
          </button>
          {submit.isError && (
            <p className="text-red-600">{(submit.error as Error).message}</p>
          )}
        </div>
      )}
    </section>
  );
}

/** Per-finding block: determination history per stage + the controls for
 *  the stage currently in progress. */
export function DeterminationControl({
  reviewId,
  workflow,
  findingId,
}: {
  reviewId: string;
  workflow: WorkflowOut;
  findingId: string;
}) {
  const open = openStage(workflow);
  const [decision, setDecision] = useState<"concur" | "override" | null>(null);
  const [comment, setComment] = useState("");
  const [editedText, setEditedText] = useState("");

  const submit = useWorkflowMutation<"concur" | "override">(
    reviewId,
    () => `/reviews/${reviewId}/stages/${open?.id}/determinations`,
    (d) => ({
      finding_id: findingId,
      decision: d,
      comment: comment.trim() || null,
      edited_text: editedText.trim() || null,
    }),
  );

  const history = workflow.stages
    .map((stage) => ({ stage, det: latestByFinding(stage).get(findingId) }))
    .filter((x): x is { stage: StageOut; det: DeterminationOut } => !!x.det);

  const submitDecision = (d: "concur" | "override") => {
    submit.mutate(d, {
      onSuccess: () => {
        setDecision(null);
        setComment("");
        setEditedText("");
      },
    });
  };

  if (history.length === 0 && !open) {
    // paper fallback: nothing digital recorded and no stage in progress
    return (
      <div className="mt-3 flex items-center gap-6 border-t border-dashed border-stone-200 pt-3 text-[11px] text-stone-600">
        <span className="font-medium">Reviewer determination:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded-sm border border-stone-400" />
          Concur
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded-sm border border-stone-400" />
          Override
        </span>
        <span className="ml-auto text-stone-400">initials ________</span>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-dashed border-stone-200 pt-3 text-[11px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-stone-600">
          Reviewer determination:
        </span>
        {history.map(({ stage, det }) => (
          <span
            key={det.id}
            title={det.comment ?? undefined}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${
              det.decision === "concur"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            R{stage.stage_number} ·{" "}
            {det.decision === "concur" ? "Concur" : "Override"} —{" "}
            {det.reviewer_name}
          </span>
        ))}
        {history.length === 0 && (
          <span className="text-stone-400">none yet</span>
        )}
      </div>

      {history.some(({ det }) => det.comment || det.edited_text) && (
        <div className="mt-2 space-y-1 text-stone-600">
          {history.map(({ stage, det }) =>
            det.comment || det.edited_text ? (
              <div key={det.id}>
                {det.comment && (
                  <p>
                    <span className="font-medium">
                      R{stage.stage_number} comment:
                    </span>{" "}
                    {det.comment}
                  </p>
                )}
                {det.edited_text && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1">
                    <span className="font-medium">
                      R{stage.stage_number} revised text:
                    </span>{" "}
                    {det.edited_text}
                  </p>
                )}
              </div>
            ) : null,
          )}
        </div>
      )}

      {open && (
        <div className="mt-2 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-stone-500">Review {open.stage_number}:</span>
            <button
              onClick={() => submitDecision("concur")}
              disabled={submit.isPending}
              className="rounded-md border border-green-300 px-2 py-1 font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
            >
              Concur
            </button>
            <button
              onClick={() =>
                setDecision(decision === "override" ? null : "override")
              }
              aria-pressed={decision === "override"}
              className={`rounded-md border px-2 py-1 font-semibold ${
                decision === "override"
                  ? "border-amber-500 bg-amber-50 text-amber-800"
                  : "border-amber-300 text-amber-700 hover:bg-amber-50"
              }`}
            >
              Override…
            </button>
          </div>
          {decision === "override" && (
            <div className="mt-2 space-y-1.5">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What is wrong with this finding? (comment)"
                rows={2}
                className="w-full rounded-md border border-stone-300 px-2 py-1.5"
              />
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                placeholder="Reviewer's replacement text (optional)"
                rows={2}
                className="w-full rounded-md border border-stone-300 px-2 py-1.5"
              />
              <button
                onClick={() => submitDecision("override")}
                disabled={
                  submit.isPending || (!comment.trim() && !editedText.trim())
                }
                className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Record override
              </button>
            </div>
          )}
          {submit.isError && (
            <p className="mt-1 text-red-600">
              {(submit.error as Error).message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
