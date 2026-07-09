import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { apiGet } from "../api/client";
import type { ReviewSummary, UsageSummary } from "../api/types";
import { CodeTabs } from "../components/platform/CodeTabs";
import { displayName, timeAgo } from "../lib/format";
import type { RulesetInfo } from "../api/types";
import { RulesetBadge } from "../components/RulesetBadge";
import {
  CURL_EXAMPLE,
  INSTALL_NPM,
  PYTHON_COMING_SOON,
  REST_EXAMPLE,
  TS_EXAMPLE,
} from "../lib/snippets";

// One engine, multiple interfaces — every integration returns identical,
// evidence-verified findings from the same Review Engine.
const INTEGRATIONS_AVAILABLE = [
  {
    name: "Playground",
    blurb:
      "Run evidence-verified reviews interactively — upload, review, and walk the finding dossiers.",
    href: "/playground",
    external: false,
  },
  {
    name: "REST API",
    blurb:
      "The canonical interface. Embed reviews into any backend, pipeline, or eTMF workflow.",
    href: "/reference",
    external: false,
  },
  {
    name: "TypeScript SDK",
    blurb:
      "@citera/sdk — typed client for Node and the browser: upload, review, wait, report.",
    href: "/reference",
    external: false,
  },
  {
    name: "Claude MCP",
    blurb:
      "@citera/mcp — ask Claude to review a protocol; findings come from the same engine.",
    href: "https://github.com/huseindra/citera/tree/main/packages/mcp",
    external: true,
  },
] as const;

const INTEGRATIONS_ROADMAP = [
  ["Cursor", "regulatory review inside the editor"],
  ["OpenAI Agents", "Citera as an agent tool"],
  ["LangGraph", "review nodes in agent graphs"],
  ["CrewAI", "compliance crew member"],
  ["n8n", "no-code review automations"],
] as const;

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
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Get API key
          </Link>
          <Link
            to="/playground"
            className="rounded-lg border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
          >
            Open Playground
          </Link>
          <Link
            to="/reference"
            className="rounded-lg border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
          >
            View API Reference
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
            { label: "REST", code: REST_EXAMPLE },
            { label: "cURL", code: CURL_EXAMPLE },
            { label: "Python", code: PYTHON_COMING_SOON },
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

      {/* Integrations — one engine, multiple interfaces */}
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-stone-800">Integrations</h2>
          <span className="text-[11px] text-stone-400">
            Every interface returns identical findings from the same engine
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {INTEGRATIONS_AVAILABLE.map((integration) => (
            <div
              key={integration.name}
              className="rounded-xl border border-stone-200 bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-stone-800">
                  {integration.name}
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                  <Check aria-hidden className="h-3 w-3" /> Available
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                {integration.blurb}
              </p>
              {integration.external ? (
                <a
                  href={integration.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-0.5 text-[11px] font-medium text-blue-600 hover:text-blue-700"
                >
                  Get started <ArrowUpRight aria-hidden className="h-3 w-3" />
                </a>
              ) : (
                <Link
                  to={integration.href}
                  className="mt-2 inline-flex items-center gap-0.5 text-[11px] font-medium text-blue-600 hover:text-blue-700"
                >
                  Get started <ArrowRight aria-hidden className="h-3 w-3" />
                </Link>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
            Integration roadmap
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {INTEGRATIONS_ROADMAP.map(([name, blurb]) => (
              <span key={name} className="text-xs text-stone-500">
                <span className="font-medium text-stone-700">{name}</span>
                {" — "}
                {blurb}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Rulesets */}
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-stone-800">Rulesets</h2>
          <span className="text-[11px] text-stone-400">
            Regulatory requirements are pluggable, versioned packs
          </span>
        </div>
        <RulesetsStrip />
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
            className="mt-2 inline-block text-[11px] font-medium text-blue-600 underline-offset-2 hover:text-blue-700 hover:underline"
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
              ["API Reference", "/reference", false],
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

function RulesetsStrip() {
  const rulesets = useQuery({
    queryKey: ["rulesets"],
    queryFn: () => apiGet<RulesetInfo[]>("/rulesets"),
    staleTime: Infinity,
  });
  const entries = rulesets.data ?? [];
  const available = entries.filter((r) => r.status === "available");
  const roadmap = entries.filter((r) => r.status === "roadmap");

  return (
    <div className="mt-3 rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap gap-1.5">
        {available.map((r) => (
          <RulesetBadge
            key={r.id}
            rulesetId={r.id}
            status={r.status}
            label={`${r.authority} · ${r.version}`}
          />
        ))}
      </div>
      {roadmap.length > 0 && (
        <p className="mt-2 text-[11px] text-stone-400">
          Roadmap: {roadmap.map((r) => r.authority).join(" · ")}
        </p>
      )}
    </div>
  );
}
