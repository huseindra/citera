// Homepage v2 — infrastructure storytelling. One message, told in
// order: Citera is Clinical Regulatory Intelligence Infrastructure;
// the Playground, REST API, SDK, and MCP are interfaces to one engine.
// No gradients, no illustrations, no buzzwords — trust, evidence,
// engineering quality.

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, Check, X as XIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { apiGet, type HealthResponse } from "../api/client";
import type { RulesetInfo } from "../api/types";
import { CodeTabs } from "../components/platform/CodeTabs";
import { RulesetBadge } from "../components/RulesetBadge";
import {
  CURL_EXAMPLE,
  PYTHON_COMING_SOON,
  REST_EXAMPLE,
  TS_EXAMPLE,
} from "../lib/snippets";

const GITHUB = "https://github.com/huseindra/citera";

const HERO_BADGES = [
  "FDA 21 CFR Part 50.25",
  "Evidence-backed",
  "Audit-ready",
  "Claude MCP Compatible",
] as const;

const TRADITIONAL_AI = [
  "Generates summaries",
  "Hallucinates",
  "No regulatory evidence",
  "No audit trail",
  "Difficult to defend during audits",
] as const;

const CITERA_WAY = [
  "Evidence-backed findings",
  "Exact regulatory citations",
  "Cross-document validation",
  "Suggested compliant language",
  "Replayable audit trail",
  "SDK + MCP ready",
] as const;

// Outcomes, not implementation.
const CLINICAL_INTELLIGENCE = [
  ["Evidence-backed Review", "Every finding is supported by verbatim evidence."],
  ["Cross-document Validation", "Compare Protocol against Informed Consent automatically."],
  ["Regulatory Rulesets", "Review against jurisdiction-specific regulations."],
  ["Regulatory Readiness", "Instantly measure review completeness."],
  ["Suggested Revisions", "Generate compliant replacement language."],
  ["Replayable Audit", "Every review is traceable and reproducible."],
] as const;

// One engine, multiple interfaces — platform capabilities, not products.
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
    href: `${GITHUB}/tree/main/packages/sdk`,
    external: true,
  },
  {
    name: "Claude MCP",
    blurb:
      "@citera/mcp — ask Claude to review a protocol; findings come from the same engine.",
    href: `${GITHUB}/tree/main/packages/mcp`,
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

const MCP_FLOW = [
  "Claude MCP",
  "Citera Review Engine",
  "Critical Findings",
  "Evidence",
  "Suggested Revision",
  "Audit Trail",
] as const;

const FEATURED_STUDIES = [
  ["Studi Tuberkulosis (TBC-311)", "Phase 2 · BPOM Indonesia"],
  ["Oncology Phase III (ONC-450)", "Phase 3 · FDA"],
  ["Hypertension Trial (AUV-330)", "Phase 3 · TGA Australia"],
] as const;

const PRINCIPLES = [
  ["Evidence", "before AI."],
  ["Regulations", "before opinions."],
  ["Audit", "before automation."],
  ["Infrastructure", "before applications."],
] as const;

export function PlatformHome() {
  return (
    <div className="mx-auto max-w-3xl space-y-14 px-6 pb-16 pt-14">
      {/* Hero */}
      <section>
        <div className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">
          Citera
        </div>
        <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-stone-900">
          Clinical Regulatory Intelligence Infrastructure
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-stone-500">
          Embed evidence-backed clinical regulatory review into any
          application, workflow, or AI agent. Every finding is
          source-verifiable, explainable, and audit-ready.
        </p>
        <div className="mt-6 flex gap-2">
          <Link
            to="/keys"
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Get API Key
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
        <div className="mt-6 flex flex-wrap gap-1.5">
          {HERO_BADGES.map((badge) => (
            <span
              key={badge}
              className="rounded-full border border-stone-200 bg-white px-2.5 py-0.5 text-[10px] font-medium text-stone-500"
            >
              {badge}
            </span>
          ))}
        </div>
      </section>

      {/* Why Citera */}
      <section>
        <h2 className="text-sm font-semibold text-stone-800">Why Citera?</h2>
        <p className="mt-1 text-xs text-stone-500">
          Traditional LLMs generate answers. Citera generates defensible
          regulatory decisions.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              Traditional AI
            </div>
            <ul className="mt-2.5 space-y-1.5">
              {TRADITIONAL_AI.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-xs leading-5 text-stone-500"
                >
                  <XIcon aria-hidden className="mt-1 h-3 w-3 shrink-0 text-red-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-stone-300 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-800">
              Citera
            </div>
            <ul className="mt-2.5 space-y-1.5">
              {CITERA_WAY.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-xs leading-5 text-stone-700"
                >
                  <Check aria-hidden className="mt-1 h-3 w-3 shrink-0 text-green-600" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section>
        <h2 className="text-sm font-semibold text-stone-800">
          One Engine. Multiple Interfaces.
        </h2>
        <div className="mt-3 rounded-2xl border border-stone-200 bg-white px-5 py-6">
          <div className="mx-auto w-fit rounded-lg border border-stone-900 px-5 py-2 text-sm font-semibold text-stone-900">
            Review Engine
          </div>
          <div className="mx-auto h-4 w-px bg-stone-300" />
          <div className="mx-auto w-2/3 border-t border-stone-300" />
          <div className="grid grid-cols-3">
            {(
              [
                ["Playground", ["Reviewers"]],
                ["REST API", ["Developers"]],
                ["MCP Server", ["Claude Desktop", "Claude Code", "Future AI Agents"]],
              ] as const
            ).map(([iface, audiences]) => (
              <div key={iface} className="flex flex-col items-center">
                <div className="h-4 w-px bg-stone-300" />
                <div className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-800">
                  {iface}
                </div>
                <div className="mt-2 text-center text-[11px] leading-4 text-stone-400">
                  {audiences.map((audience) => (
                    <div key={audience}>{audience}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 border-t border-stone-100 pt-3 text-center text-[11px] text-stone-400">
            Every interface is powered by the same Clinical Regulatory
            Intelligence Engine. Business logic exists only once.
          </p>
        </div>
      </section>

      {/* Clinical Intelligence */}
      <section>
        <h2 className="text-sm font-semibold text-stone-800">
          Clinical Intelligence
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {CLINICAL_INTELLIGENCE.map(([title, blurb]) => (
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

      {/* Integrate Anywhere */}
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-stone-800">
            Integrate Anywhere
          </h2>
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

      {/* Built for Claude */}
      <section>
        <h2 className="text-sm font-semibold text-stone-800">Built for Claude</h2>
        <p className="mt-1 text-xs text-stone-500">
          Use Citera directly inside Claude through the Model Context
          Protocol.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="rounded-lg bg-stone-100 px-3 py-2 text-xs leading-5 text-stone-700">
              “Review this informed consent form against FDA regulations.”
            </div>
            <div className="mt-3 space-y-0.5 pl-3 font-mono text-[11px] leading-5 text-stone-500">
              {MCP_FLOW.map((step, i) => (
                <div key={step}>
                  {i > 0 && <div className="text-stone-300">↓</div>}
                  <span className={i <= 1 ? "font-semibold text-stone-800" : ""}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-between rounded-xl border border-stone-200 bg-white p-4">
            <div>
              <div className="text-sm font-semibold text-stone-800">
                Claude explains the compliance issues — with evidence
              </div>
              <p className="mt-1.5 text-xs leading-5 text-stone-500">
                Five domain tools — review documents, list rulesets, get a
                finding dossier, list findings, export a report. Every quote
                Claude cites is span-verified by the engine; every suggested
                revision is labeled as an AI draft.
              </p>
            </div>
            <a
              href={`${GITHUB}/tree/main/packages/mcp`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex w-fit items-center gap-1 rounded-lg border border-stone-300 px-3 py-1.5 text-[11px] font-semibold text-stone-700 hover:bg-stone-50"
            >
              View MCP Documentation <ArrowUpRight aria-hidden className="h-3 w-3" />
            </a>
          </div>
        </div>
      </section>

      {/* Regulatory Rulesets */}
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-stone-800">
            Regulatory Rulesets
          </h2>
          <span className="text-[11px] text-stone-400">
            Regulations are pluggable, versioned packs
          </span>
        </div>
        <RulesetsSection />
      </section>

      {/* Quick start */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-stone-800">Quick start</h2>
          <code className="font-mono text-[11px] text-stone-400">
            $ npm install @citera/sdk
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

      {/* Playground preview */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-stone-800">
          Try Citera in under 30 seconds.
        </h2>
        <p className="mt-1 text-xs text-stone-500">
          Load a sample study — no uploads required.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {FEATURED_STUDIES.map(([title, detail]) => (
            <Link
              key={title}
              to="/playground"
              className="rounded-xl border border-stone-200 p-3 hover:bg-stone-50"
            >
              <div className="text-xs font-semibold text-stone-800">{title}</div>
              <div className="mt-0.5 text-[11px] text-stone-400">{detail}</div>
            </Link>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <Link
            to="/playground"
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Load Sample Study
          </Link>
          <Link
            to="/playground"
            className="rounded-lg border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
          >
            Open Playground
          </Link>
        </div>
      </section>

      {/* Platform principles */}
      <section className="rounded-2xl border border-stone-200 bg-white px-5 py-4">
        <div className="grid grid-cols-4 gap-3">
          {PRINCIPLES.map(([lead, rest]) => (
            <div key={lead} className="text-xs leading-5 text-stone-500">
              <span className="font-semibold text-stone-800">{lead}</span>{" "}
              {rest}
            </div>
          ))}
        </div>
      </section>

      {/* Footer resources */}
      <footer className="border-t border-stone-200 pt-6">
        <div className="grid grid-cols-3 gap-x-6 gap-y-1.5 text-xs">
          {(
            [
              ["Playground", "/playground", false],
              ["API Reference", "/reference", false],
              ["SDK Documentation", `${GITHUB}/tree/main/packages/sdk`, true],
              ["Claude MCP", `${GITHUB}/tree/main/packages/mcp`, true],
              ["Rulesets", `${GITHUB}/tree/main/packages/rulesets`, true],
              ["GitHub", GITHUB, true],
              ["Documentation", `${GITHUB}/tree/main/docs`, true],
              ["Roadmap", `${GITHUB}/blob/main/docs/roadmap.md`, true],
            ] as const
          ).map(([label, href, external]) =>
            external ? (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-stone-500 hover:text-stone-800"
              >
                {label}
              </a>
            ) : (
              <Link
                key={label}
                to={href}
                className="text-stone-500 hover:text-stone-800"
              >
                {label}
              </Link>
            ),
          )}
          <PlatformStatus />
        </div>
        <p className="mt-5 text-[11px] text-stone-400">
          Citera — Clinical Regulatory Intelligence. Built for CROs, biotech
          teams, regulatory affairs, quality &amp; compliance, and healthcare
          AI developers.
        </p>
      </footer>
    </div>
  );
}

function PlatformStatus() {
  const { data, isError } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiGet<HealthResponse>("/health"),
    refetchInterval: 20_000,
  });
  const ok = !isError && data?.status === "ok";
  return (
    <span className="inline-flex items-center gap-1.5 text-stone-500">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          ok ? "bg-green-500" : "bg-amber-500"
        }`}
      />
      {ok ? "All systems operational" : "Platform degraded"}
    </span>
  );
}

function RulesetsSection() {
  const rulesets = useQuery({
    queryKey: ["rulesets"],
    queryFn: () => apiGet<RulesetInfo[]>("/rulesets"),
    staleTime: Infinity,
  });
  const entries = rulesets.data ?? [];
  const available = entries.filter((r) => r.status === "available");
  const preview = entries.filter((r) => r.status === "in_development");
  const roadmap = entries.filter((r) => r.status === "roadmap");

  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {available.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-stone-200 bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <RulesetBadge
                rulesetId={r.id}
                status={r.status}
                label={r.authority}
              />
              <span className="font-mono text-[11px] text-stone-400">
                v{r.version}
              </span>
            </div>
            <div className="mt-2 text-xs font-medium text-stone-700">
              {r.coverage ?? r.name}
            </div>
            <div className="mt-0.5 text-[11px] text-stone-400">
              {r.jurisdiction} · {r.rule_count} requirements
            </div>
          </div>
        ))}
      </div>
      {preview.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
            Preview
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {preview.map((r) => (
              <RulesetBadge
                key={r.id}
                rulesetId={r.id}
                status={r.status}
                label={`${r.authority} · ${r.jurisdiction}`}
              />
            ))}
          </div>
        </div>
      )}
      {roadmap.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
            Roadmap
          </span>
          <p className="mt-1 text-xs text-stone-500">
            {roadmap.map((r) => r.authority).join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}
