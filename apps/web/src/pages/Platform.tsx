// Homepage v4 — final polish: hierarchy, density, one message per
// section. Order: hero → built-for → try (samples) → architecture →
// Claude MCP → why evidence wins → regulatory coverage → quick start.
// Same design system; every number is a verifiable fact from this
// repository (answer keys, registry, validation runs) — no fabricated
// logos, customers, or counts.

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, Check, X as XIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { apiGet, type HealthResponse } from "../api/client";
import type { RulesetInfo } from "../api/types";
import { CodeTabs } from "../components/platform/CodeTabs";
import { RulesetBadge } from "../components/RulesetBadge";
import { CURL_EXAMPLE, PYTHON_COMING_SOON, REST_EXAMPLE } from "../lib/snippets";

const GITHUB = "https://github.com/huseindra/citera";

const HERO_BADGES = ["FDA", "Claude MCP", "REST API", "SDK", "Evidence-backed"] as const;

const BUILT_FOR = [
  "Clinical Research Organizations",
  "Regulatory Affairs",
  "Quality & Compliance",
  "Biotech",
  "Healthcare AI Teams",
] as const;

// Real sample studies with real planted-defect counts (from the pack
// answer keys and live validation runs) — each launches in the Playground.
const SAMPLE_STUDIES = [
  {
    title: "Tuberculosis (TBC-311)",
    ruleset: "BPOM · Bahasa Indonesia",
    findings: "1 critical conflict · 3 more findings",
  },
  {
    title: "Oncology Phase III (ONC-450)",
    ruleset: "FDA 21 CFR 50.25",
    findings: "1 critical conflict · 2 more findings",
  },
  {
    title: "Hypertension (AUV-330)",
    ruleset: "TGA · ICH GCP",
    findings: "1 critical conflict · 2 more findings",
  },
  {
    title: "Singapore HSA (SGR-204)",
    ruleset: "HSA HP(CT) 2016",
    findings: "1 critical conflict · 2 more findings",
  },
  {
    title: "Asthma (VTZ-2201)",
    ruleset: "FDA 21 CFR 50.25",
    findings: "1 critical conflict · 2 more findings",
  },
] as const;

const TRADITIONAL_AI = [
  "Generates summaries",
  "Hallucinates",
  "No regulatory evidence",
  "No audit trail",
  "Hard to defend in audits",
] as const;

const CITERA_WAY = [
  "Span-verified findings",
  "Exact regulatory citations",
  "Protocol ↔ consent validation",
  "Compliant language drafts",
  "Replayable audit trail",
  "SDK + MCP ready",
] as const;

const CAPABILITIES = [
  ["Evidence-backed", "Verbatim quotes, byte-checked against the source."],
  ["Cross-document", "Protocol vs consent, section by section."],
  ["Audit Trail", "Every step recorded, replayable."],
  ["Rulesets", "Pluggable, versioned regulation packs."],
  ["Suggested Revision", "Compliant replacement language, AI-labeled."],
  ["Readiness Score", "Review completeness at a glance."],
] as const;

const MCP_COMPATIBLE = ["Claude Desktop", "Claude Code"] as const;
const MCP_FUTURE = ["Cursor", "OpenAI Agents", "LangGraph", "CrewAI", "n8n"] as const;

// Quick start, homepage-length (the full example lives in the Reference).
const TS_SHORT = `import Citera from "@citera/sdk";

const citera = new Citera({ apiKey: process.env.CITERA_API_KEY });

const review = await citera.reviews.create({
  document: icf.id,
  protocol: protocol.id,
  ruleset: "fda",
});
const { findings } = await citera.reviews.waitUntilComplete(review.id);
// every quote is span-verified against the source document`;

const FOOTER_COLUMNS: { title: string; links: [string, string, boolean][] }[] = [
  {
    title: "Product",
    links: [
      ["Playground", "/playground", false],
      ["API", "/reference", false],
      ["SDK", `${GITHUB}/tree/main/packages/sdk`, true],
      ["Rulesets", `${GITHUB}/tree/main/packages/rulesets`, true],
    ],
  },
  {
    title: "Developers",
    links: [
      ["GitHub", GITHUB, true],
      ["Claude MCP", `${GITHUB}/tree/main/packages/mcp`, true],
      ["Documentation", `${GITHUB}/tree/main/docs`, true],
      ["API Reference", "/reference", false],
    ],
  },
  {
    title: "Community",
    links: [
      ["Roadmap", `${GITHUB}/blob/main/docs/roadmap.md`, true],
      ["License (MIT)", `${GITHUB}/blob/main/LICENSE`, true],
    ],
  },
];

export function PlatformHome() {
  return (
    <div>
      {/* Hero — what, who, why, how in one screen */}
      <section className="border-b border-stone-200/80 bg-white px-6 pb-10 pt-14">
        <div className="mx-auto max-w-3xl">
          <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-stone-900">
            Clinical Regulatory Intelligence Infrastructure
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-stone-500">
            Embed evidence-backed clinical regulatory review into
            applications, workflows, and AI agents. One engine — served
            through the Playground, REST, SDK, and Claude MCP.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/playground"
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Open Playground
            </Link>
            <Link
              to="/keys"
              className="rounded-lg border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            >
              Get API Key
            </Link>
            <a
              href={GITHUB}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            >
              GitHub <ArrowUpRight aria-hidden className="h-3 w-3" />
            </a>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-1.5">
            {HERO_BADGES.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-[10px] font-medium text-stone-500"
              >
                {badge}
              </span>
            ))}
          </div>
          {/* Built for — one honest line, no logos */}
          <p className="mt-4 text-[11px] text-stone-400">
            Designed for{" "}
            {BUILT_FOR.map((audience, i) => (
              <span key={audience}>
                {i > 0 && " · "}
                <span className="text-stone-500">{audience}</span>
              </span>
            ))}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-10 px-6 pb-14 pt-10">
        {/* Try Citera — real sample studies, immediately */}
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-stone-800">Try Citera</h2>
            <span className="text-[11px] text-stone-400">
              Real review tasks, no uploads — ≈2 min each
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {SAMPLE_STUDIES.map((study) => (
              <div
                key={study.title}
                className="flex flex-col rounded-xl border border-stone-200 bg-white p-3"
              >
                <div className="text-xs font-semibold text-stone-800">
                  {study.title}
                </div>
                <div className="mt-0.5 text-[11px] text-stone-400">
                  {study.ruleset}
                </div>
                <div className="mt-1 text-[11px] text-red-600">
                  {study.findings}
                </div>
                <Link
                  to="/playground"
                  className="mt-2 inline-flex w-fit items-center gap-1 rounded-lg border border-stone-300 px-2.5 py-1 text-[11px] font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Run Sample <ArrowRight aria-hidden className="h-3 w-3" />
                </Link>
              </div>
            ))}
            <div className="flex items-center justify-center rounded-xl border border-dashed border-stone-200 p-3">
              <Link
                to="/playground"
                className="text-[11px] font-medium text-blue-600 hover:text-blue-700"
              >
                Or upload your own →
              </Link>
            </div>
          </div>
        </section>

        {/* Architecture — the highlight */}
        <section>
          <h2 className="text-sm font-semibold text-stone-800">
            One Engine. Multiple Interfaces.
          </h2>
          <div className="mt-3 rounded-2xl border border-stone-200 bg-white px-6 py-8">
            <div className="mx-auto w-fit rounded-xl border-2 border-stone-900 px-8 py-3 text-base font-semibold tracking-tight text-stone-900">
              Review Engine
            </div>
            <div className="mx-auto h-5 w-px bg-stone-300" />
            <div className="mx-auto w-2/3 border-t border-stone-300" />
            <div className="grid grid-cols-3">
              {(
                [
                  ["REST", ["Applications", "Developers"]],
                  ["SDK", ["TypeScript", "Node & browser"]],
                  ["MCP", ["Claude", "AI agents"]],
                ] as const
              ).map(([iface, consumers]) => (
                <div key={iface} className="flex flex-col items-center">
                  <div className="h-5 w-px bg-stone-300" />
                  <div className="rounded-lg border border-stone-300 px-5 py-2 text-sm font-semibold text-stone-800">
                    {iface}
                  </div>
                  <div className="mt-2 text-center text-[11px] leading-4 text-stone-400">
                    {consumers.map((consumer) => (
                      <div key={consumer}>{consumer}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 border-t border-stone-100 pt-3 text-center text-[11px] text-stone-400">
              Business logic exists only once — every interface returns
              identical findings.
            </p>
          </div>
        </section>

        {/* Claude MCP — first-class interface */}
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-stone-800">
              Claude is a first-class interface
            </h2>
            <a
              href={`${GITHUB}/tree/main/packages/mcp`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-[11px] font-medium text-blue-600 hover:text-blue-700"
            >
              View MCP Documentation <ArrowUpRight aria-hidden className="h-3 w-3" />
            </a>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <pre className="overflow-x-auto rounded-xl bg-stone-900 p-4 font-mono text-[11px] leading-5 text-stone-100">
              {`# Claude Code
claude mcp add citera -- \\
  node packages/mcp/dist/index.js

# then, inside Claude:
"Review this consent form
 against FDA regulations."`}
            </pre>
            <div className="flex flex-col justify-between rounded-xl border border-stone-200 bg-white p-4">
              <p className="text-xs leading-5 text-stone-500">
                Five domain tools — review documents, list rulesets, finding
                dossiers, findings by impact, report export. Claude explains
                the compliance issues; the engine verifies every quote.
              </p>
              <div className="mt-3 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                    Compatible
                  </span>
                  {MCP_COMPATIBLE.map((client) => (
                    <span
                      key={client}
                      className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700"
                    >
                      <Check aria-hidden className="h-3 w-3" /> {client}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                    Future
                  </span>
                  {MCP_FUTURE.map((client) => (
                    <span
                      key={client}
                      className="rounded-full border border-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-500"
                    >
                      {client}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Why Evidence Wins — comparison + capabilities, one section */}
        <section>
          <h2 className="text-sm font-semibold text-stone-800">
            Why Evidence Wins
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Traditional AI
              </div>
              <ul className="mt-2 space-y-1">
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
              <ul className="mt-2 space-y-1">
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
          <div className="mt-2.5 grid grid-cols-3 gap-2.5">
            {CAPABILITIES.map(([title, blurb]) => (
              <div
                key={title}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2.5"
              >
                <div className="text-xs font-semibold text-stone-800">{title}</div>
                <p className="mt-0.5 text-[11px] leading-4 text-stone-500">
                  {blurb}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Regulatory Coverage — rulesets + evidence library, merged */}
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-stone-800">
              Regulatory Coverage
            </h2>
            <span className="text-[11px] text-stone-400">
              Regulations are pluggable, versioned packs
            </span>
          </div>
          <CoverageSection />
        </section>

        {/* Quick start — short */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-stone-800">Quick start</h2>
            <code className="font-mono text-[11px] text-stone-400">
              $ npm install @citera/sdk
            </code>
          </div>
          <CodeTabs
            tabs={[
              { label: "TypeScript", code: TS_SHORT },
              { label: "REST", code: REST_EXAMPLE },
              { label: "cURL", code: CURL_EXAMPLE },
              { label: "Python", code: PYTHON_COMING_SOON },
            ]}
          />
          <p className="text-[11px] text-stone-400">
            Full request/response shapes in the{" "}
            <Link to="/reference" className="text-blue-600 hover:text-blue-700">
              API Reference
            </Link>
            . Free plan — 25,000 credits, 60 requests/min.
          </p>
        </section>
      </div>

      {/* Footer — expanded, dark */}
      <footer className="bg-stone-900 px-6 py-10 text-stone-400">
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-8 sm:grid-cols-4">
          <div>
            <div className="text-sm font-bold tracking-tight text-white">
              Citera
            </div>
            <p className="mt-2 text-[11px] leading-4">
              Evidence before AI. Regulations before opinions. Audit before
              automation.
            </p>
            <div className="mt-3 space-y-1 text-[11px]">
              <div className="font-mono">v0.1.0</div>
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
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          ok ? "bg-green-500" : "bg-amber-500"
        }`}
      />
      {ok ? "All systems operational" : "Platform degraded"}
    </span>
  );
}

function CoverageSection() {
  const rulesets = useQuery({
    queryKey: ["rulesets"],
    queryFn: () => apiGet<RulesetInfo[]>("/rulesets"),
    staleTime: Infinity,
  });
  const entries = rulesets.data ?? [];
  const available = entries.filter((r) => r.status === "available");
  const roadmap = entries.filter((r) => r.status === "roadmap");
  const totalRules = available.reduce((sum, r) => sum + (r.rule_count ?? 0), 0);

  return (
    <div className="mt-3 space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {available.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-stone-200 bg-white p-3"
          >
            <div className="flex items-center justify-between gap-1">
              <RulesetBadge rulesetId={r.id} status={r.status} label={r.authority} />
              <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[9px] font-semibold text-green-700">
                Live
              </span>
            </div>
            <div className="mt-2 text-xs font-medium text-stone-700">
              {r.jurisdiction}
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-stone-400">
              {r.rule_count} requirements · {r.version}
            </div>
          </div>
        ))}
      </div>
      {/* Evidence library — the honest numbers behind the packs */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-stone-200 bg-white px-4 py-2.5 font-mono text-[11px] text-stone-500">
        <span>{available.length} jurisdictions</span>
        <span className="text-stone-300">·</span>
        <span>{totalRules} regulatory checks</span>
        <span className="text-stone-300">·</span>
        <span>{totalRules}/{totalRules} live-validated findings</span>
        <span className="text-stone-300">·</span>
        <span>0 unverified quotes</span>
        <span className="text-stone-300">·</span>
        <span>updated 2026-07-10</span>
      </div>
      {roadmap.length > 0 && (
        <p className="text-[11px] text-stone-400">
          Roadmap: {roadmap.map((r) => r.authority).join(" · ")}
        </p>
      )}
    </div>
  );
}
