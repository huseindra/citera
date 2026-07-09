// The right panel: the SDK Console. Every Playground action mirrored as
// its API call — requests and responses shown here are the REAL ones the
// Playground made; the console teaches the SDK with the truth, not mock
// JSON.

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { PYTHON_COMING_SOON } from "../../lib/snippets";
import { CodeTabs } from "../platform/CodeTabs";

export interface ApiLogEntry {
  operation: string; // e.g. client.documents.upload()
  method: string;
  path: string;
  request?: unknown;
  response?: unknown;
}

function pretty(value: unknown, max = 900): string {
  const text = JSON.stringify(value, null, 2) ?? "";
  return text.length > max ? text.slice(0, max) + "\n  …" : text;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      aria-label="Copy to clipboard"
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-stone-400 hover:bg-stone-100 hover:text-stone-600"
    >
      {copied ? (
        <>
          <Check aria-hidden className="h-3 w-3 text-green-600" /> copied
        </>
      ) : (
        <>
          <Copy aria-hidden className="h-3 w-3" /> copy
        </>
      )}
    </button>
  );
}

export function ApiSidebar({
  log,
  liveSnippet,
}: {
  log: ApiLogEntry[];
  liveSnippet: string;
}) {
  const last = log[log.length - 1];
  const requestText = last
    ? `${last.method} ${last.path}${last.request ? `\n${pretty(last.request)}` : ""}`
    : "";

  return (
    <aside className="flex h-full flex-col gap-4 overflow-y-auto border-l border-stone-200 bg-sidebar p-4">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
          Developer Console
        </div>
        <p className="mt-0.5 text-[11px] text-stone-400">
          Live — exactly what this Playground just called.
        </p>
      </div>

      {last ? (
        <div className="space-y-3">
          <div className="font-mono text-[11px] font-semibold text-stone-700">
            {last.operation}
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-stone-400">
                Request
              </span>
              <CopyButton text={requestText} />
            </div>
            <pre className="overflow-x-auto rounded-lg bg-stone-900 p-3 text-[11px] leading-4 text-stone-100">
              {requestText}
            </pre>
          </div>
          {last.response !== undefined && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-stone-400">
                  Response
                </span>
                <CopyButton text={JSON.stringify(last.response, null, 2)} />
              </div>
              <pre className="max-h-56 overflow-auto rounded-lg bg-stone-900 p-3 text-[11px] leading-4 text-green-100/90">
                {pretty(last.response)}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-stone-200 p-3 text-[11px] text-stone-400">
          Upload a document or run a review — the request and response will
          appear here as you go.
        </p>
      )}

      {log.length > 1 && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-stone-400">
            Session calls
          </div>
          <ol className="space-y-0.5 font-mono text-[10px] text-stone-500">
            {log.map((entry, i) => (
              <li key={i}>
                {i + 1}. {entry.method} {entry.path}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-auto space-y-3">
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-stone-400">
            Your session as SDK code
          </div>
          <CodeTabs
            tabs={[
              { label: "TypeScript", code: liveSnippet },
              {
                label: "REST",
                code: last ? requestText : "# run an action first",
              },
              {
                label: "cURL",
                code: last
                  ? `curl -s ${last.method === "GET" ? "" : `-X ${last.method} `}http://localhost:8000${last.path} \\\n  -H "Authorization: Bearer $CITERA_API_KEY"${
                      last.request
                        ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(last.request)}'`
                        : ""
                    }`
                  : "# run an action first",
              },
              { label: "Python", code: PYTHON_COMING_SOON },
            ]}
          />
        </div>
        <p className="border-t border-stone-200 pt-3 text-[10px] leading-4 text-stone-400">
          <span className="font-semibold text-stone-500">SDK Demo</span> —
          every action shown in this Playground can be performed through the
          Citera SDK.
        </p>
      </div>
    </aside>
  );
}
