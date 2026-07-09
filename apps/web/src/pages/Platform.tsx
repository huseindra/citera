// Homepage v3 — infrastructure storytelling with a stronger, centered
// narrative arc (hero prompt → pipeline → proof → capabilities →
// integrations → Claude setup → rulesets → quick start). Same visual
// language: warm stone neutrals, blue #2563EB for actions only, the
// evidence palette for status. Every number on this page is a real,
// verifiable fact from the repository — no fabricated logos, customers,
// or testimonials.

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FileDiff,
  HeartHandshake,
  Languages,
  ListChecks,
  Send,
  ShieldAlert,
  X as XIcon,
  type LucideIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
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

// "Review anything:" — one row per review capability, phrased as the
// question a reviewer would actually ask.
const REVIEW_ANYTHING: {
  Icon: LucideIcon;
  label: string;
  example: string;
}[] = [
  {
    Icon: ShieldAlert,
    label: "Risk disclosure",
    example: "“Does the ICF understate risks documented in the protocol?”",
  },
  {
    Icon: ListChecks,
    label: "Required elements",
    example: "“Is the right to withdraw stated — or missing entirely?”",
  },
  {
    Icon: HeartHandshake,
    label: "Injury & compensation",
    example: "“Is compensation for research injury fully described?”",
  },
  {
    Icon: FileDiff,
    label: "Cross-document",
    example: "“Do consent procedures match the protocol, section by section?”",
  },
  {
    Icon: Languages,
    label: "Multilingual",
    example: "“Tinjau ICF Bahasa Indonesia terhadap CUKB BPOM 2024.”",
  },
];

// Public track record — real, verifiable numbers from this repository.
const TRACK_RECORD = [
  {
    stat: "4 / 4 rulesets live",
    detail:
      "FDA, HSA, BPOM, and TGA packs — all released at v1.0.0, none stuck in preview.",
  },
  {
    stat: "56 requirements",
    detail:
      "Reviewer-level rules across 4 jurisdictions, each carrying its native statutory citations.",
  },
  {
    stat: "56 / 56 live-validated",
    detail:
      "Every pack reproduced its planted-defect answer key against live Claude + Voyage before release.",
    highlight: true,
  },
  {
    stat: "0 unverified quotes",
    detail:
      "The grounding gate rejects any quote that fails byte-for-byte span verification — rejection over hallucination.",
  },
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

const FOOTER_COLUMNS: {
  title: string;
  links: [string, string, boolean][];
}[] = [
  {
    title: "Product",
    links: [
      ["Playground", "/playground", false],
      ["Developer Console", "/keys", false],
      ["API Reference", "/reference", false],
    ],
  },
  {
    title: "Developers",
    links: [
      ["TypeScript SDK", `${GITHUB}/tree/main/packages/sdk`, true],
      ["Claude MCP", `${GITHUB}/tree/main/packages/mcp`, true],
      ["Documentation", `${GITHUB}/tree/main/docs`, true],
      ["GitHub", GITHUB, true],
    ],
  },
  {
    title: "Regulatory",
    links: [
      ["Rulesets", `${GITHUB}/tree/main/packages/rulesets`, true],
      ["Legal research notes", `${GITHUB}/blob/main/docs/rulesets-research.md`, true],
      ["Roadmap", `${GITHUB}/blob/main/docs/roadmap.md`, true],
    ],
  },
];

export function PlatformHome() {
  const navigate = useNavigate();

  return (
    <div>
      {/* Hero — centered, whitespace-first */}
      <section className="border-b border-stone-200/80 bg-white px-6 pb-14 pt-20">
        <div className="mx-auto max-w-2xl text-center">
          <div className="font-mono text-[11px] font-medium uppercase tracking-widest text-stone-400">
            Clinical Regulatory Intelligence
          </div>
          <h1 className="mx-auto mt-3 max-w-xl text-3xl font-semibold leading-tight tracking-tight text-stone-900">
            Regulatory review that can defend itself.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-stone-500">
            Citera is Clinical Regulatory Intelligence Infrastructure. Embed
            evidence-backed review into any application, workflow, or AI
            agent — every finding source-verifiable, explainable, and
            audit-ready.
          </p>

          {/* Review prompt — routes to the Playground */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate("/playground");
            }}
            className="mx-auto mt-7 flex max-w-md items-center gap-2 rounded-xl border border-stone-300 bg-white py-1.5 pl-4 pr-1.5 shadow-sm focus-within:border-blue-600"
          >
            <input
              readOnly
              placeholder="Does the ICF disclose the hepatotoxicity documented in the protocol?"
              className="w-full cursor-pointer bg-transparent text-xs text-stone-600 placeholder:text-stone-400 focus:outline-none"
              onClick={() => navigate("/playground")}
              aria-label="Start a review in the Playground"
            />
            <button
              type="submit"
              aria-label="Open the Playground"
              className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700"
            >
              <Send aria-hidden className="h-3.5 w-3.5" />
            </button>
          </form>
          <a
            href="#built-for-claude"
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700"
          >
            or, give it to your Claude <ArrowRight aria-hidden className="h-3 w-3" />
          </a>

          {/* Pipeline */}
          <div className="mx-auto mt-10 max-w-xl overflow-x-auto">
            <div className="whitespace-nowrap font-mono text-[12px] leading-6 text-stone-600">
              protocol + icf ─▶{" "}
              <span className="font-semibold text-stone-900">
                [ verify · ground · audit ]
              </span>{" "}
              ─▶ findings
            </div>
            <div className="mt-0.5 grid grid-cols-3 font-mono text-[10px] text-stone-400">
              <span>documents</span>
              <span>Review Engine</span>
              <span>every quote span-checked</span>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-1.5">
            {HERO_BADGES.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-[10px] font-medium text-stone-500"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Proof strip */}
      <div className="border-b border-stone-200/80 bg-stone-50 px-6 py-2.5">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[11px] text-stone-500">
          <span>4 rulesets live at v1.0.0</span>
          <span className="text-stone-300">·</span>
          <span>56 requirements across 4 jurisdictions</span>
          <span className="text-stone-300">·</span>
          <Link
            to="/playground"
            className="font-medium text-blue-600 hover:text-blue-700"
          >
            Try a sample study →
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-14 px-6 pb-16 pt-14">
        {/* Review anything */}
        <section>
          <h2 className="text-sm font-semibold text-stone-800">
            Review anything:
          </h2>
          <div className="mt-3 space-y-2">
            {REVIEW_ANYTHING.map(({ Icon, label, example }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-2.5"
              >
                <Icon aria-hidden className="h-4 w-4 shrink-0 text-stone-400" />
                <div className="min-w-0 flex-1 text-xs">
                  <span className="font-semibold text-stone-800">{label}:</span>{" "}
                  <span className="truncate text-stone-500">{example}</span>
                </div>
                <Link
                  to="/playground"
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-stone-300 px-2.5 py-1 text-[11px] font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Run <ArrowRight aria-hidden className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-2.5 text-[11px] text-stone-400">
            Free plan — 25,000 credits, 60 requests/min. Plus the toolkit
            around a review: suggested revisions and a replayable audit trail.
          </p>
        </section>

        {/* Public track record */}
        <section>
          <h2 className="text-sm font-semibold text-stone-800">
            Our public track record
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TRACK_RECORD.map(({ stat, detail, ...rest }) => (
              <div
                key={stat}
                className={`rounded-xl border bg-white p-4 ${
                  "highlight" in rest && rest.highlight
                    ? "border-blue-600/40"
                    : "border-stone-200"
                }`}
              >
                <div className="font-mono text-sm font-semibold leading-5 text-stone-900">
                  {stat}
                </div>
                <p className="mt-1.5 text-[11px] leading-4 text-stone-500">
                  {detail}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-stone-400">
            Last validated 2026-07-10 — live Claude + Voyage, no mocks.
          </p>
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
        <section id="built-for-claude">
          <h2 className="text-sm font-semibold text-stone-800">
            Turn Claude into a regulatory reviewer
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            Use Citera directly inside Claude through the Model Context
            Protocol — five domain tools, the same engine, the same findings.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                Claude Desktop
              </div>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-stone-900 p-3 font-mono text-[11px] leading-5 text-stone-100">
                {`Settings → Developer → Edit Config
"citera": { "command": "node",
  "args": ["…/packages/mcp/dist/index.js"] }`}
              </pre>
              <a
                href={`${GITHUB}/tree/main/packages/mcp`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-0.5 text-[11px] font-medium text-blue-600 hover:text-blue-700"
              >
                Setup guide <ArrowUpRight aria-hidden className="h-3 w-3" />
              </a>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                Claude Code
              </div>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-stone-900 p-3 font-mono text-[11px] leading-5 text-stone-100">
                {`claude mcp add citera -- \\
  node …/packages/mcp/dist/index.js`}
              </pre>
              <a
                href={`${GITHUB}/tree/main/packages/mcp`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-0.5 text-[11px] font-medium text-blue-600 hover:text-blue-700"
              >
                Setup guide <ArrowUpRight aria-hidden className="h-3 w-3" />
              </a>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-stone-500">
              <span className="rounded-md bg-stone-100 px-2 py-1 text-stone-700">
                “Review this informed consent form against FDA regulations.”
              </span>
              <span className="text-stone-300">→</span>
              <span className="font-semibold text-stone-800">Claude MCP</span>
              <span className="text-stone-300">→</span>
              <span className="font-semibold text-stone-800">Review Engine</span>
              <span className="text-stone-300">→</span>
              <span>findings · evidence · suggested revisions · audit trail</span>
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
      </div>

      {/* Footer — dark, columnar */}
      <footer className="bg-stone-900 px-6 py-10 text-stone-400">
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-8 sm:grid-cols-4">
          <div>
            <div className="text-sm font-bold tracking-tight text-white">
              Citera
            </div>
            <p className="mt-2 text-[11px] leading-4">
              Clinical Regulatory Intelligence. Built for CROs, biotech teams,
              regulatory affairs, quality &amp; compliance, and healthcare AI
              developers.
            </p>
            <div className="mt-3">
              <PlatformStatus />
            </div>
          </div>
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                {column.title}
              </div>
              <ul className="mt-2 space-y-1.5 text-xs">
                {column.links.map(([label, href, external]) => (
                  <li key={label}>
                    {external ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-white"
                      >
                        {label}
                      </a>
                    ) : (
                      <Link to={href} className="hover:text-white">
                        {label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
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
    <span className="inline-flex items-center gap-1.5 text-[11px]">
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
                {r.version}
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
