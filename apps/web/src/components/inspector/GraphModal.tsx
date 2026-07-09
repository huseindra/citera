import { X as XIcon } from "lucide-react";
import { Suspense, lazy, useEffect } from "react";
import type { FindingEvidenceOut, FindingOut } from "../../api/types";

const CitationGraphView = lazy(() =>
  import("../finding/CitationGraph").then((m) => ({
    default: m.CitationGraphView,
  })),
);

export function GraphModal({
  finding,
  evidence,
  onScrollToOffset,
  onClose,
}: {
  finding: FindingOut;
  evidence: FindingEvidenceOut | null;
  onScrollToOffset: (offset: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label="Citation graph"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[70vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5">
          <div className="text-sm font-semibold text-stone-800">
            Citation graph — {finding.rule_title ?? finding.rule_id}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-stone-400 hover:bg-stone-100"
          >
            <XIcon aria-hidden className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center text-xs text-stone-400">
                Loading graph…
              </div>
            }
          >
            <CitationGraphView
              finding={finding}
              evidence={evidence}
              onScrollToOffset={onScrollToOffset}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
