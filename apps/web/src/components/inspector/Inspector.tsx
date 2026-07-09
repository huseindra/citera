// The Finding Dossier: one scrolling column in reviewer reading order —
// Finding → Impact → Evidence → Requirement → Analysis → Recommended
// Action → Reviewer Decision → Audit Trail.
// Internals (embeddings, retrieval scores, prompts) are never exposed
// here: the dossier speaks the reviewer's language, the audit log keeps
// the machinery.

import { useQuery } from "@tanstack/react-query";
import { Check, Copy, FileCheck2, Sparkles, X as XIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../../api/client";
import type {
  FindingEvidenceOut,
  FindingOut,
  FindingStatus,
  RuleSetOut,
} from "../../api/types";
import { STATUS_META } from "../../lib/status";
import { EvidenceBlock } from "../EvidenceBlock";
import { AuditReplay } from "../finding/AuditReplay";
import { EvidencePathStrip } from "./EvidencePathStrip";
import { StrengthMeter } from "./StrengthMeter";

interface Props {
  reviewId: string;
  rulesetId: string;
  finding: FindingOut;
  onClose: () => void;
  onScrollToOffset: (offset: number) => void;
}

const IMPACT: Record<string, string> = {
  critical: "Must be resolved before the ICF can be submitted.",
  major: "Should be resolved before submission.",
  minor: "Review recommended — low regulatory exposure.",
};

// Deterministic, status-derived guidance — rule-based, not model output.
const RECOMMENDED_ACTION: Record<FindingStatus, string> = {
  conflicting:
    "Reconcile the ICF with the study protocol value, then re-run the review.",
  partial: "Amend this ICF section to fully address the requirement.",
  not_found: "Add the missing required element to the ICF.",
  evaluation_failed:
    "Re-run the review — this requirement could not be evaluated.",
  satisfied: "No action required.",
};

export function Inspector({
  reviewId,
  rulesetId,
  finding,
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
  // served from the same cache the review page already filled
  const ruleset = useQuery({
    queryKey: ["ruleset", rulesetId],
    queryFn: () => apiGet<RuleSetOut>(`/rulesets/${rulesetId}`),
    staleTime: Infinity,
  });
  const rule = ruleset.data?.rules.find((r) => r.id === finding.rule_id);
  const groundedSection =
    finding.span != null
      ? (evidence.data?.results.find(
          (r) =>
            r.char_start !== null &&
            r.char_end !== null &&
            r.char_start <= finding.span!.char_start &&
            r.char_end >= finding.span!.char_start,
        )?.section_title ?? null)
      : null;

  return (
    <aside className="flex h-full flex-col border-l border-stone-200 bg-white">
      {/* 1. Finding */}
      <div className="flex items-start justify-between gap-2 border-b border-stone-100 px-4 py-3">
        <div className="min-w-0">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.chip}`}
          >
            <meta.Icon aria-hidden className="h-3 w-3" />
            {meta.label}
          </span>
          <h3 className="mt-1.5 text-sm font-semibold leading-5 text-stone-800">
            {finding.rule_title ?? finding.rule_id}
          </h3>
          <div className="text-[11px] text-stone-400">{finding.citation}</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close inspector"
          className="rounded-md px-2 py-1 text-stone-400 hover:bg-stone-100"
        >
          <XIcon aria-hidden className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
        {/* 2. Impact */}
        {finding.severity && finding.status !== "satisfied" && (
          <section>
            <SectionLabel>Impact</SectionLabel>
            <p className="text-xs leading-5 text-stone-700">
              <span className="font-semibold capitalize">{finding.severity}</span>
              {IMPACT[finding.severity] && ` — ${IMPACT[finding.severity]}`}
            </p>
          </section>
        )}

        {/* 3. Evidence */}
        <section>
          <SectionLabel>Evidence Ledger</SectionLabel>
          <div className="space-y-3">
            <EvidencePathStrip
              finding={finding}
              evidence={evidence.data ?? null}
              onScrollToOffset={onScrollToOffset}
            />
            <EvidenceCards
              finding={finding}
              section={groundedSection}
              onScrollToOffset={onScrollToOffset}
            />
            <StrengthMeter strength={finding.evidence_strength} />
          </div>
        </section>

        {/* 4. Requirement */}
        {rule && (
          <section>
            <SectionLabel>Requirement</SectionLabel>
            <p className="rounded-lg border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs leading-5 text-stone-600">
              <span className="font-medium text-stone-700">{rule.citation}</span>{" "}
              — {rule.description}
            </p>
          </section>
        )}

        {/* 5. Analysis — Claude's assessment, clearly attributed */}
        <section>
          <SectionLabel>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles aria-hidden className="h-3 w-3" /> Analysis
            </span>
          </SectionLabel>
          <p className="leading-6 text-stone-700">{finding.reasoning}</p>
          {finding.status !== "conflicting" && finding.protocol_reference && (
            <p className="mt-2 text-xs text-stone-500">
              Protocol reference: {finding.protocol_reference}
            </p>
          )}
        </section>

        {/* 6. Recommended action — deterministic, from the finding status */}
        <section>
          <SectionLabel>Recommended action</SectionLabel>
          <p className="text-xs leading-5 text-stone-700">
            {RECOMMENDED_ACTION[finding.status]}
          </p>
          {finding.suggested_revision && (
            <SuggestedRevision text={finding.suggested_revision} />
          )}
        </section>

        {/* 7. Reviewer decision — the human signs off, on the report */}
        <section className="rounded-lg border border-stone-200 px-3 py-2.5">
          <SectionLabel>Reviewer decision</SectionLabel>
          <p className="text-[11px] leading-4 text-stone-500">
            AI findings assist the reviewer; the reviewer makes the final
            determination. Record Concur / Override on the exported report.
          </p>
          <Link
            to={`/playground/reviews/${reviewId}/report`}
            className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600 underline-offset-2 hover:text-blue-700 hover:underline"
          >
            <FileCheck2 aria-hidden className="h-3 w-3" /> Open sign-off report
          </Link>
        </section>

        {/* 8. Audit trail — one click away, never one tab away */}
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">
      {children}
    </div>
  );
}

/** AI-drafted replacement text. Generated, not quoted — labeled as a
 *  draft so it is never mistaken for verified document evidence. */
function SuggestedRevision({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50/50 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-sky-600">
          <Sparkles aria-hidden className="h-3 w-3" /> Suggested revision — AI
          draft
        </span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-sky-600 hover:bg-sky-100"
        >
          {copied ? (
            <>
              <Check aria-hidden className="h-3 w-3" /> copied
            </>
          ) : (
            <>
              <Copy aria-hidden className="h-3 w-3" /> copy
            </>
          )}
        </button>
      </div>
      <p className="mt-1 text-xs leading-5 text-stone-700">{text}</p>
      <p className="mt-1.5 text-[10px] leading-4 text-stone-400">
        Drafted by the review engine from the protocol — verify before use;
        the reviewer owns the final wording.
      </p>
    </div>
  );
}

function EvidenceCards({
  finding,
  section,
  onScrollToOffset,
}: {
  finding: FindingOut;
  section: string | null;
  onScrollToOffset: (offset: number) => void;
}) {
  if (finding.status === "not_found") {
    return (
      <div className="rounded-lg border border-sky-100 border-l-4 border-l-sky-500 bg-sky-50/50 px-3 py-2.5 text-stone-700">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-stone-500">
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

  return (
    <div className="space-y-2">
      <EvidenceBlock
        quote={finding.verbatim_quote}
        source="Informed Consent Form"
        page={finding.span?.page}
        section={section}
        chars={
          finding.span
            ? { start: finding.span.char_start, end: finding.span.char_end }
            : null
        }
        verified={!!finding.span}
        onClick={
          finding.span
            ? () => onScrollToOffset(finding.span!.char_start)
            : undefined
        }
      />
      {finding.status === "conflicting" && finding.protocol_reference && (
        <EvidenceBlock
          label="Protocol says"
          accent="conflict"
          quote={finding.protocol_reference}
          source="Study Protocol"
        />
      )}
    </div>
  );
}
