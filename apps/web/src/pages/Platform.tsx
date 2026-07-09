import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { apiGet } from "../api/client";
import type { ReviewSummary, UsageSummary } from "../api/types";
import { CodeTabs } from "../components/platform/CodeTabs";
import { displayName, timeAgo } from "../lib/format";
import {
  CURL_EXAMPLE,
  INSTALL_NPM,
  PY_EXAMPLE,
  TS_EXAMPLE,
} from "../lib/snippets";

const CAPABILITIES = [
  ["Analyze Protocols", "Parse and index clinical protocols with exact source spans."],
  ["Review Informed Consent", "Check ICFs against FDA 21 CFR 50.25, element by element."],
  ["Cross-document Validation", "Catch contradictions between protocol and consent."],
  ["Regulatory Evidence", "Every finding carries a verbatim, span-verified quote."],
  ["Compliance Findings", "Structured statuses: satisfied, partial, conflicting, absent."],
  ["Audit Trail", "Append-only, replayable record of every analysis step."],
] as const;

export function PlatformHome() {
  const usage = useQuery({
    queryKey: ["usage"],
    queryFn: () => apiGet<UsageSummary>("/v1/usage/summary"),
  });
  const reviews = useQuery({
    queryKey: ["reviews"],
    queryFn: () => apiGet<ReviewSummary[]>("/reviews"),
  });
  const u = usage.data;

  return (
    <div className="mx-auto max-w-3xl space-y-12 px-6 pb-16 pt-14">
      {/* Hero */}
      <section>
        <div className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">
          Clinical Regulatory Intelligence Platform
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">
          Clinical Regulatory Intelligence SDK
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-stone-500">
          Embed AI-powered clinical review into any workflow with a single
          SDK. Every finding is evidence-verified, explainable, and
          audit-replayable — infrastructure, not another document system.
        </p>
        <div className="mt-5 flex gap-2">
          <Link
            to="/keys"
            className="rounded-lg bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800"
          >
            Get API key
          </Link>
          <Link
            to="/playground"
            className="rounded-lg border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
          >
            Open Playground
          </Link>
        </div>
      </section>

      {/* Quick start */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-stone-800">Quick start</h2>
          <code className="font-mono text-[11px] text-stone-400">
            $ {INSTALL_NPM}
          </code>
        </div>
        <CodeTabs
          tabs={[
            { label: "TypeScript", code: TS_EXAMPLE },
            { label: "Python", code: PY_EXAMPLE },
            { label: "curl", code: CURL_EXAMPLE },
          ]}
        />
      </section>

      {/* How it works */}
      <section className="rounded-2xl border border-stone-200 bg-white px-5 py-4">
        <div className="font-mono text-[12px] leading-6 text-stone-600">
          your app ─▶ <span className="font-semibold text-stone-900">Citera SDK</span> ─▶
          [ verify · ground · audit ] ─▶ findings
        </div>
        <p className="mt-1 text-[11px] text-stone-400">
          Generated claims never reach you unverified — quotes that can't be
          located in the source document are rejected, not returned.
        </p>
      </section>

      {/* Capabilities */}
      <section>
        <h2 className="text-sm font-semibold text-stone-800">Capabilities</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {CAPABILITIES.map(([title, blurb]) => (
            <div
              key={title}
              className="rounded-xl border border-stone-200 bg-white p-4"
            >
              <div className="text-sm font-semibold text-stone-800">{title}</div>
              <p className="mt-1 text-xs leading-5 text-stone-500">{blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Usage + activity */}
      <section className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
            Plan
          </div>
          <div className="mt-1 text-lg font-semibold text-stone-900">
            {u?.plan ?? "—"}
          </div>
          <div className="text-[11px] text-stone-400">
            {u ? `${u.credits.remaining.toLocaleString()} credits left` : ""}
          </div>
          <Link
            to="/keys"
            className="mt-2 inline-block text-[11px] font-medium text-stone-600 underline"
          >
            <span className="inline-flex items-center gap-0.5">Manage keys <ArrowRight aria-hidden className="h-3 w-3" /></span>
          </Link>
        </div>
        <div className="col-span-2 rounded-xl border border-stone-200 bg-white p-4">
          <div className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
            Recent API activity
          </div>
          <ul className="mt-2 space-y-1">
            {(u?.recent ?? []).slice(0, 5).map((r, i) => (
              <li
                key={i}
                className="flex justify-between font-mono text-[11px] text-stone-600"
              >
                <span>{r.operation}</span>
                <span className="text-stone-400">{timeAgo(r.at)}</span>
              </li>
            ))}
            {(u?.recent.length ?? 0) === 0 && (
              <li className="text-xs text-stone-400">
                No activity yet — run something in the Playground.
              </li>
            )}
          </ul>
        </div>
      </section>

      {/* Sessions + links */}
      <section className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="text-sm font-semibold text-stone-800">
            Latest playground sessions
          </h2>
          <ul className="mt-2 space-y-1.5">
            {(reviews.data ?? []).slice(0, 3).map((r) => (
              <li key={r.id}>
                <Link
                  to={`/playground/reviews/${r.id}`}
                  className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs hover:bg-stone-50"
                >
                  <span className="font-medium text-stone-700">
                    {displayName(r.document_filename)}
                  </span>
                  <span className="text-stone-400">{r.status}</span>
                </Link>
              </li>
            ))}
            {reviews.data?.length === 0 && (
              <li className="text-xs text-stone-400">
                None yet —{" "}
                <Link to="/playground" className="underline">
                  start one
                </Link>
                .
              </li>
            )}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-stone-800">Resources</h2>
          <ul className="mt-2 space-y-1.5 text-xs">
            {[
              ["API Reference", "http://localhost:8000/docs", true],
              ["Documentation", "https://github.com/huseindra/citera/tree/main/docs", true],
              ["SDK & examples", "/keys", false],
              ["Playground", "/playground", false],
            ].map(([label, href, external]) => (
              <li key={label as string}>
                {external ? (
                  <a
                    href={href as string}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-stone-700 hover:bg-stone-50"
                  >
                    {label} <ArrowUpRight aria-hidden className="h-3 w-3" />
                  </a>
                ) : (
                  <Link
                    to={href as string}
                    className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-stone-700 hover:bg-stone-50"
                  >
                    {label} <ArrowRight aria-hidden className="h-3 w-3" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
