// Documentation hub — Claude first. The landing promotes what supports
// the story ("Claude proposes, Citera verifies"); developer tooling
// (SDK, API Keys, architecture) lives under Advanced. Nothing is
// deleted, only re-ranked.

import { ArrowRight, ArrowUpRight, Star } from "lucide-react";
import { Link } from "react-router-dom";

const GITHUB = "https://github.com/huseindra/citera";

interface DocSection {
  title: string;
  blurb: string;
  href: string;
  external: boolean;
  featured?: boolean;
}

const SECTIONS: DocSection[] = [
  {
    title: "Overview",
    blurb:
      "What Citera is and how the pieces fit: one Verification Engine — Claude proposes, Citera verifies.",
    href: `${GITHUB}/tree/main/docs`,
    external: true,
  },
  {
    title: "Quick Start",
    blurb:
      "Run an evidence-verified review and read the findings in minutes — through Claude or plain HTTP.",
    href: "/reference",
    external: false,
  },
  {
    title: "Claude MCP",
    blurb:
      "The primary integration. Give Claude the Verify Loop: verify_revision, explain_failure, prepare_submission — rejected → revised → Verified → Submission Ready.",
    href: `${GITHUB}/tree/main/packages/mcp`,
    external: true,
    featured: true,
  },
  {
    title: "REST API",
    blurb:
      "The canonical interface. Documents, reviews, findings, verifications, and reports over plain HTTP.",
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
    title: "API Reference",
    blurb:
      "Every endpoint with request and response shapes, ready-to-copy snippets, and error semantics.",
    href: "/reference",
    external: false,
  },
];

// Available, not promoted — discovered when actually needed.
const ADVANCED: DocSection[] = [
  {
    title: "Developer SDK",
    blurb: "@citera/sdk — the typed client the MCP server is built on.",
    href: `${GITHUB}/tree/main/packages/sdk`,
    external: true,
  },
  {
    title: "API Keys",
    blurb: "Programmatic access and higher Public Sandbox limits.",
    href: "/keys",
    external: false,
  },
  {
    title: "Architecture",
    blurb: "How the engine, transports, and audit trail fit together.",
    href: `${GITHUB}/blob/main/docs/architecture.md`,
    external: true,
  },
];

function SectionCard({ section }: { section: DocSection }) {
  const inner = (
    <>
      <div className="flex items-center justify-between text-sm font-semibold text-stone-800">
        <span className="inline-flex items-center gap-1.5">
          {section.title}
          {section.featured && (
            <Star aria-hidden className="h-3 w-3 fill-blue-600 text-blue-600" />
          )}
        </span>
        {section.external ? (
          <ArrowUpRight
            aria-hidden
            className="h-3.5 w-3.5 text-stone-300 group-hover:text-stone-500"
          />
        ) : (
          <ArrowRight
            aria-hidden
            className="h-3.5 w-3.5 text-stone-300 group-hover:text-stone-500"
          />
        )}
      </div>
      <p className="mt-1 text-xs leading-5 text-stone-500">{section.blurb}</p>
    </>
  );
  const className = `group rounded-xl border bg-white p-4 hover:bg-stone-50 ${
    section.featured ? "border-blue-600/40" : "border-stone-200"
  }`;
  return section.external ? (
    <a
      href={section.href}
      target="_blank"
      rel="noreferrer"
      className={className}
    >
      {inner}
    </a>
  ) : (
    <Link to={section.href} className={className}>
      {inner}
    </Link>
  );
}

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
        Use Citera through Claude — or embed evidence-backed regulatory
        verification into any application over the REST API.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3">
        {SECTIONS.map((section) => (
          <SectionCard key={section.title} section={section} />
        ))}
      </div>

      <div className="mt-10 border-t border-stone-200 pt-5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
          Advanced
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {ADVANCED.map((section) => (
            <SectionCard key={section.title} section={section} />
          ))}
        </div>
      </div>
    </div>
  );
}
