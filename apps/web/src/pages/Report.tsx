import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { apiGet } from "../api/client";
import type { DocumentText, ReviewOut } from "../api/types";
import { EvidenceBlock } from "../components/EvidenceBlock";
import { displayName, rulesetName } from "../lib/format";
import { STATUS_META } from "../lib/status";
import { SEVERITY_ORDER } from "../lib/status";

/** Print-optimized review report: findings with verified quotes, audit
 *  references, and a reviewer-determination block per finding — the
 *  human-in-the-loop sign-off, on paper. */
export function ReportPage() {
  const { reviewId } = useParams();

  const review = useQuery({
    queryKey: ["review", reviewId],
    queryFn: () => apiGet<ReviewOut>(`/reviews/${reviewId}`),
  });
  const documentText = useQuery({
    queryKey: ["document-text", review.data?.document_id],
    queryFn: () =>
      apiGet<DocumentText>(`/documents/${review.data!.document_id}/text`),
    enabled: !!review.data?.document_id,
  });

  if (!review.data || !documentText.data) {
    return <div className="p-8 text-sm text-stone-400">Preparing report…</div>;
  }
  const data = review.data;

  const findings = [...data.findings].sort((a, b) => {
    const byStatus = STATUS_META[a.status].order - STATUS_META[b.status].order;
    if (byStatus !== 0) return byStatus;
    return (
      (SEVERITY_ORDER[a.severity ?? "minor"] ?? 9) -
      (SEVERITY_ORDER[b.severity ?? "minor"] ?? 9)
    );
  });
  const issues = findings.filter((f) => f.status !== "satisfied");

  return (
    <div className="min-h-screen bg-white text-stone-900">
      {/* screen-only toolbar */}
      <div className="flex items-center justify-between border-b border-stone-200 px-8 py-3 print:hidden">
        <Link
          to={`/playground/reviews/${data.id}`}
          className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Back to review
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="mx-auto max-w-3xl px-8 py-10 text-[13px] leading-6">
        <header className="border-b-2 border-stone-900 pb-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
            Citera — Evidence Intelligence · Compliance Review Report
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {displayName(documentText.data.filename)}
          </h1>
          <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-stone-600">
            <div className="flex gap-2">
              <dt className="text-stone-400">Rule set</dt>
              <dd>{rulesetName(data.ruleset_id)} (v{data.ruleset_version})</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-stone-400">Reviewed at</dt>
              <dd>{new Date(data.created_at).toLocaleString()}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-stone-400">Review ID</dt>
              <dd className="font-mono text-[10px]">{data.id}</dd>
            </div>
          </dl>
        </header>

        <section className="mt-6">
          <h2 className="text-sm font-semibold">Summary</h2>
          <p className="mt-1 text-stone-600">
            {data.rule_count} requirements of {rulesetName(data.ruleset_id)}{" "}
            were evaluated against the study protocol.{" "}
            {issues.length === 0
              ? "All requirements were satisfied."
              : `${issues.length} require${issues.length === 1 ? "s" : ""} reviewer attention.`}{" "}
            Every quoted passage below was programmatically verified to exist
            verbatim in the source document; the complete retrieval, prompt,
            and grounding trail for each finding is replayable in Citera under
            the listed finding ID.
          </p>
          <div className="mt-3 flex gap-2">
            {findings.length > 0 &&
              Object.entries(
                findings.reduce<Record<string, number>>((acc, f) => {
                  acc[f.status] = (acc[f.status] ?? 0) + 1;
                  return acc;
                }, {}),
              ).map(([status, count]) => (
                <span
                  key={status}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_META[status as keyof typeof STATUS_META].chip}`}
                >
                  {(() => {
                    const StatusIcon =
                      STATUS_META[status as keyof typeof STATUS_META].Icon;
                    return <StatusIcon aria-hidden className="h-3 w-3" />;
                  })()}
                  {count} {STATUS_META[status as keyof typeof STATUS_META].label.toLowerCase()}
                </span>
              ))}
          </div>
        </section>

        <section className="mt-8 space-y-6">
          {findings.map((f, index) => {
            const meta = STATUS_META[f.status];
            return (
              <article
                key={f.id}
                className="break-inside-avoid rounded-lg border border-stone-200 p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-semibold">
                    {index + 1}. {f.rule_title ?? f.rule_id}
                  </h3>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.chip}`}
                  >
                    <meta.Icon aria-hidden className="h-3 w-3" /> {meta.label}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-stone-400">
                  {f.citation}
                  {f.severity && ` · severity: ${f.severity}`}
                  {f.evidence_strength && ` · evidence: ${f.evidence_strength}`}
                </div>

                {f.verbatim_quote && (
                  <div className="mt-3">
                    <EvidenceBlock
                      quote={f.verbatim_quote}
                      source="Informed Consent Form"
                      page={f.span?.page}
                      chars={
                        f.span
                          ? { start: f.span.char_start, end: f.span.char_end }
                          : null
                      }
                      verified={!!f.span}
                    />
                  </div>
                )}
                {f.status === "not_found" && f.queries_executed && (
                  <p className="mt-3 text-[12px] text-stone-600">
                    <span className="font-medium">Evidence of absence:</span>{" "}
                    searched {f.queries_executed.length} queries (
                    {f.queries_executed.map((q) => `“${q}”`).join(", ")}) with
                    no relevant match.
                  </p>
                )}
                {f.protocol_reference && (
                  <p className="mt-2 text-[12px] text-stone-600">
                    <span className="font-medium">Protocol reference:</span>{" "}
                    {f.protocol_reference}
                  </p>
                )}
                <p className="mt-2 text-stone-700">{f.reasoning}</p>
                {f.suggested_revision && (
                  <div className="mt-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] leading-5 text-stone-700">
                    <span className="font-medium">
                      Suggested revision (AI draft — verify before use):
                    </span>{" "}
                    {f.suggested_revision}
                  </div>
                )}
                <div className="mt-2 font-mono text-[9px] text-stone-400">
                  finding {f.id}
                </div>

                {/* human-in-the-loop: the reviewer decides */}
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
                  <span className="ml-auto text-stone-400">
                    initials ________
                  </span>
                </div>
              </article>
            );
          })}
        </section>

        <footer className="mt-10 border-t border-stone-300 pt-6">
          <p className="text-[11px] text-stone-500">
            This report was generated by Citera. AI findings assist the
            reviewer; the reviewer makes the final determination. Full audit
            trail (retrieval scores, prompts, model responses, grounding
            verification) is preserved in the append-only audit log.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-12 text-[11px] text-stone-600">
            <div>
              <div className="border-b border-stone-400 pb-8" />
              <div className="mt-1">Reviewer signature</div>
            </div>
            <div>
              <div className="border-b border-stone-400 pb-8" />
              <div className="mt-1">Date</div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
