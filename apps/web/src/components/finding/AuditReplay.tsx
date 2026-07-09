// The dossier's audit trail shows WHAT happened and WHEN — step, model,
// timestamp — replayed from the append-only log. Payload internals
// (prompts, retrieval scores, embeddings) are never rendered here; they
// remain in the audit log itself, retrievable through the API.

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../api/client";
import type { AuditRecordOut, FindingAuditOut } from "../../api/types";
import { recordedModel, stepMeta } from "../../lib/audit";

interface Props {
  reviewId: string;
  findingId: string;
}

export function AuditReplay({ reviewId, findingId }: Props) {
  const audit = useQuery({
    queryKey: ["finding-audit", findingId],
    queryFn: () =>
      apiGet<FindingAuditOut>(
        `/reviews/${reviewId}/findings/${findingId}/audit`,
      ),
    retry: false,
  });

  if (audit.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-stone-400">
        Loading audit trail…
      </div>
    );
  }
  if (audit.isError || !audit.data) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-red-600">
        No audit trail available for this finding.
      </div>
    );
  }

  const { records } = audit.data;
  const model = recordedModel(records);
  const first = records[0]?.created_at;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm">
      <p className="mb-3 text-[11px] text-stone-400">
        Recorded {first ? new Date(first).toLocaleString() : "—"}
        {model && (
          <>
            {" · "}model <span className="font-medium text-stone-500">{model}</span>
          </>
        )}
        {" · "}replayed from the append-only audit log — shown as recorded,
        never re-executed.
      </p>
      <ol className="relative ml-2 space-y-1 border-l border-stone-200 pl-5">
        {records.map((record) => (
          <TimelineStep key={record.id} record={record} />
        ))}
      </ol>
    </div>
  );
}

function TimelineStep({ record }: { record: AuditRecordOut }) {
  const meta = stepMeta(record.step);

  return (
    <li className="relative">
      <span
        aria-hidden
        className={`absolute -left-[27px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-stone-200 bg-white ${meta.tone}`}
      >
        <meta.Icon className="h-2.5 w-2.5" />
      </span>
      <div className="flex items-baseline gap-2 rounded-md px-2 py-1">
        <span className={`text-xs font-medium ${meta.tone}`}>{meta.label}</span>
        <span className="font-mono text-[10px] text-stone-400">
          {record.step}
        </span>
        <span className="ml-auto text-[10px] text-stone-400">
          {new Date(record.created_at).toLocaleTimeString()}
        </span>
      </div>
    </li>
  );
}
