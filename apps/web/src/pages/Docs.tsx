// Documentation hub — the developer entry point, one screen of links.
// Navigation simplification: the top nav carries the demo story
// (Home · Playground · Documentation · GitHub); everything a developer
// needs lives here instead of competing for attention.

import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

const GITHUB = "https://github.com/huseindra/citera";

const SECTIONS: {
  title: string;
  blurb: string;
  href: string;
  external: boolean;
}[] = [
  {
    title: "Overview",
    blurb:
      "What Citera is and how the pieces fit: one Verification Engine, served through the Playground, REST, SDK, and Claude MCP.",
    href: `${GITHUB}/tree/main/docs`,
    external: true,
  },
  {
    title: "Quick Start",
    blurb:
      "Upload a protocol and consent form, run an evidence-verified review, and read the findings — in a dozen lines of TypeScript.",
    href: "/reference",
    external: false,
  },
  {
    title: "REST API",
    blurb:
      "The canonical interface. Documents, reviews, findings, verifications, and reports over plain HTTP.",
    href: "/reference",
    external: false,
  },
  {
    title: "TypeScript SDK",
    blurb:
      "@citera/sdk — a zero-dependency typed client for Node and the browser: upload, review, verify, report.",
    href: `${GITHUB}/tree/main/packages/sdk`,
    external: true,
  },
  {
    title: "Claude MCP",
    blurb:
      "Give Claude the Verify Loop: verify_revision, prepare_submission, explain_failure — the same engine, inside Claude.",
    href: `${GITHUB}/tree/main/packages/mcp`,
    external: true,
  },
  {
    title: "API Reference",
    blurb:
      "Every endpoint with request and response shapes, ready-to-copy snippets, and error semantics.",
    href: "/reference",
    external: false,
  },
  {
    title: "Rulesets",
    blurb:
      "Regulations as pluggable, versioned packs — FDA, HSA, BPOM, TGA today; each pack self-describing and live-validated.",
    href: `${GITHUB}/tree/main/packages/rulesets`,
    external: true,
  },
  {
    title: "API Keys",
    blurb:
      "Create and manage keys for programmatic access and higher Public Sandbox limits.",
    href: "/keys",
    external: false,
  },
];

export function DocsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 pb-16 pt-14">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">
        Documentation
      </div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
        Build with Citera
      </h1>
      <p className="mt-2 max-w-lg text-sm leading-6 text-stone-500">
        Everything you need to embed evidence-backed regulatory verification
        into your application, workflow, or AI agent.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3">
        {SECTIONS.map((section) =>
          section.external ? (
            <a
              key={section.title}
              href={section.href}
              target="_blank"
              rel="noreferrer"
              className="group rounded-xl border border-stone-200 bg-white p-4 hover:bg-stone-50"
            >
              <div className="flex items-center justify-between text-sm font-semibold text-stone-800">
                {section.title}
                <ArrowUpRight
                  aria-hidden
                  className="h-3.5 w-3.5 text-stone-300 group-hover:text-stone-500"
                />
              </div>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                {section.blurb}
              </p>
            </a>
          ) : (
            <Link
              key={section.title}
              to={section.href}
              className="group rounded-xl border border-stone-200 bg-white p-4 hover:bg-stone-50"
            >
              <div className="flex items-center justify-between text-sm font-semibold text-stone-800">
                {section.title}
                <ArrowRight
                  aria-hidden
                  className="h-3.5 w-3.5 text-stone-300 group-hover:text-stone-500"
                />
              </div>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                {section.blurb}
              </p>
            </Link>
          ),
        )}
      </div>
    </div>
  );
}
