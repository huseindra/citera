// API Reference — Mintlify-style docs layout: sticky section nav on the
// left, prose + parameter tables in the middle, sticky dark code panels
// (request/response) on the right. Hand-written for the real REST
// surface — no generated Swagger, nothing aspirational.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CodeTabs } from "../components/platform/CodeTabs";

interface Param {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}

interface Endpoint {
  method: "GET" | "POST";
  path: string;
  title: string;
  description: string;
  params: Param[];
  paramsTitle: string;
  responseFields: Param[];
  request: { label: string; code: string }[];
  response: string;
}

const KEY = "$CITERA_API_KEY";

const ENDPOINTS: Endpoint[] = [
  {
    method: "POST",
    path: "/v1/documents",
    title: "Upload a document",
    description:
      "Uploads and ingests a study document. The text is canonicalized, chunked with exact character spans, and indexed for evidence retrieval — every quote Citera ever returns points back into this canonical text. Returns when the document is ready for review.",
    paramsTitle: "Form fields",
    params: [
      {
        name: "file",
        type: "file",
        required: true,
        description: "The document — .pdf, .docx, .md, or .txt.",
      },
      {
        name: "kind",
        type: "string",
        required: true,
        description: '"protocol" or "icf".',
      },
    ],
    responseFields: [
      { name: "id", type: "uuid", description: "Document id, used by reviews." },
      {
        name: "status",
        type: "string",
        description: '"ready" once chunked and indexed; "failed" with a reason otherwise.',
      },
      { name: "chunk_count", type: "number", description: "Indexed evidence chunks." },
    ],
    request: [
      {
        label: "cURL",
        code: `curl -s http://localhost:8000/v1/documents \\
  -H "Authorization: Bearer ${KEY}" \\
  -F "file=@icf.pdf" -F "kind=icf"`,
      },
      {
        label: "TypeScript",
        code: `const icf = await citera.documents.upload({
  file: icfFile,
  kind: "icf",
});`,
      },
    ],
    response: `{
  "id": "9c2e…",
  "filename": "icf.pdf",
  "kind": "icf",
  "status": "ready",
  "chunk_count": 17
}`,
  },
  {
    method: "POST",
    path: "/v1/reviews",
    title: "Start a review",
    description:
      "Runs an evidence-verified regulatory review of an ICF against a study protocol and a ruleset. Returns 202 immediately; findings stream in as each requirement is evaluated, so you can poll and render progressively.",
    paramsTitle: "Body parameters",
    params: [
      {
        name: "ruleset",
        type: "string",
        required: true,
        description:
          'Pack id or short alias — "fda", "hsa", "bpom", "tga". Reviews against non-available rulesets return an honest 422.',
      },
      {
        name: "document_id",
        type: "uuid",
        required: true,
        description: "The ICF under review.",
      },
      {
        name: "protocol_document_id",
        type: "uuid",
        required: true,
        description: "The study protocol the ICF must be consistent with.",
      },
      {
        name: "generate_suggested_revision",
        type: "boolean",
        description:
          "Draft an AI replacement text for every non-satisfied finding (labeled as a draft). Default true.",
      },
    ],
    responseFields: [
      { name: "id", type: "uuid", description: "Review id — poll it for findings." },
      {
        name: "status",
        type: "string",
        description: '"pending" → "running" → "complete" | "failed".',
      },
      { name: "rule_count", type: "number", description: "Requirements to evaluate." },
    ],
    request: [
      {
        label: "cURL",
        code: `curl -s http://localhost:8000/v1/reviews \\
  -H "Authorization: Bearer ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "ruleset": "fda",
    "document_id": "<icf-id>",
    "protocol_document_id": "<protocol-id>"
  }'`,
      },
      {
        label: "TypeScript",
        code: `const review = await citera.reviews.create({
  ruleset: "fda",
  document: icf.id,
  protocol: protocol.id,
});`,
      },
    ],
    response: `202 Accepted
{
  "id": "5b1a…",
  "status": "pending",
  "ruleset_id": "fda-21cfr50",
  "ruleset_version": "1.0.0",
  "rule_count": 8,
  "findings": []
}`,
  },
  {
    method: "GET",
    path: "/v1/reviews/{review_id}",
    title: "Read findings",
    description:
      "Returns the review with its findings. Every evidence-backed finding carries a verbatim quote that passed the span-grounding gate, with exact character offsets into the source document; absence findings carry the queries that proved the element missing. Poll until status is complete.",
    paramsTitle: "Path parameters",
    params: [
      {
        name: "review_id",
        type: "uuid",
        required: true,
        description: "The review to read.",
      },
    ],
    responseFields: [
      {
        name: "findings[].status",
        type: "string",
        description:
          "satisfied · partial · conflicting · not_found · evaluation_failed.",
      },
      {
        name: "findings[].verbatim_quote",
        type: "string",
        description:
          "Span-verified quote — guaranteed to exist at span.char_start–char_end in the canonical text.",
      },
      {
        name: "findings[].suggested_revision",
        type: "string | null",
        description: "AI-drafted replacement text, only on non-satisfied findings.",
      },
      {
        name: "findings[].citation",
        type: "string",
        description: "The statutory citation printed on compliance reports.",
      },
    ],
    request: [
      {
        label: "cURL",
        code: `curl -s http://localhost:8000/v1/reviews/<review-id> \\
  -H "Authorization: Bearer ${KEY}"`,
      },
      {
        label: "TypeScript",
        code: `const result = await citera.reviews.waitUntilComplete(review.id);
for (const finding of result.findings) {
  console.log(finding.status, finding.verbatim_quote);
}`,
      },
    ],
    response: `{
  "status": "complete",
  "findings": [
    {
      "rule_id": "fda-50.25-a2-risks",
      "citation": "21 CFR 50.25(a)(2)",
      "status": "conflicting",
      "severity": "critical",
      "verbatim_quote": "…",
      "span": { "char_start": 1535, "char_end": 1721 },
      "evidence_strength": "strong",
      "suggested_revision": "…"
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/v1/rulesets",
    title: "List rulesets",
    description:
      "Every regulatory authority is a pluggable, independently versioned ruleset. Lists available packs (runnable today), in-development packs, and the roadmap. GET /v1/rulesets/{id} returns the full rule list with native statutory references.",
    paramsTitle: "Query parameters",
    params: [],
    responseFields: [
      {
        name: "status",
        type: "string",
        description: "available · in_development · roadmap.",
      },
      { name: "version", type: "string", description: "Independent semver per pack." },
      {
        name: "aliases",
        type: "string[]",
        description: 'Short names accepted by POST /v1/reviews (e.g. "fda").',
      },
      {
        name: "languages",
        type: "string[]",
        description: "Languages the pack's retrieval targets (BPOM: id, en).",
      },
    ],
    request: [
      {
        label: "cURL",
        code: `curl -s http://localhost:8000/v1/rulesets \\
  -H "Authorization: Bearer ${KEY}"`,
      },
      {
        label: "TypeScript",
        code: `const rulesets = await citera.rulesets.list();`,
      },
    ],
    response: `[
  {
    "id": "fda-21cfr50",
    "authority": "FDA",
    "status": "available",
    "version": "v1.0.0",
    "rule_count": 8,
    "languages": ["en"],
    "aliases": ["fda"]
  }
]`,
  },
];

const METHOD_TONE: Record<string, string> = {
  GET: "bg-green-50 text-green-600 border-green-200",
  POST: "bg-blue-100/70 text-blue-700 border-blue-200",
};

function anchor(e: Endpoint): string {
  return `${e.method}-${e.path}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function ReferencePage() {
  const [active, setActive] = useState<string>(anchor(ENDPOINTS[0]));

  // scrollspy: highlight the section currently in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    for (const e of ENDPOINTS) {
      const el = document.getElementById(anchor(e));
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="mx-auto flex max-w-6xl gap-10 px-6 pb-20 pt-10">
      {/* left — sticky section nav */}
      <nav className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-6 space-y-5">
          <div>
            <div className="px-2 text-[10px] font-semibold uppercase tracking-widest text-stone-400">
              Getting started
            </div>
            <ul className="mt-1.5 space-y-0.5 text-xs">
              <li>
                <a
                  href="#authentication"
                  className="block rounded-md px-2 py-1 text-stone-600 hover:bg-stone-100"
                >
                  Authentication
                </a>
              </li>
              <li>
                <Link
                  to="/keys"
                  className="block rounded-md px-2 py-1 text-stone-600 hover:bg-stone-100"
                >
                  Get an API key
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="px-2 text-[10px] font-semibold uppercase tracking-widest text-stone-400">
              Endpoints
            </div>
            <ul className="mt-1.5 space-y-0.5 text-xs">
              {ENDPOINTS.map((e) => {
                const id = anchor(e);
                const isActive = active === id;
                return (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className={`flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors ${
                        isActive
                          ? "bg-blue-100/60 font-medium text-blue-700"
                          : "text-stone-600 hover:bg-stone-100"
                      }`}
                    >
                      <span
                        className={`w-8 shrink-0 font-mono text-[9px] font-semibold ${
                          e.method === "GET" ? "text-green-600" : "text-blue-600"
                        }`}
                      >
                        {e.method}
                      </span>
                      <span className="truncate">{e.title}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </nav>

      {/* main column */}
      <div className="min-w-0 flex-1 space-y-14">
        <header id="authentication" className="scroll-mt-6">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
            API Reference
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
            Citera REST API
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-stone-500">
            The complete review workflow is four endpoints. Everything the
            Playground shows is built on these calls — findings, evidence
            spans, suggested revisions, and the audit trail.
          </p>
          <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4">
            <div className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
              Authentication
            </div>
            <p className="mt-1 text-xs leading-5 text-stone-600">
              Pass your API key as a bearer token on every request. Create and
              rotate keys on the{" "}
              <Link
                to="/keys"
                className="font-medium text-blue-600 underline-offset-2 hover:underline"
              >
                API Keys
              </Link>{" "}
              page.
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-stone-900 p-3 font-mono text-[11px] leading-4 text-stone-100">
              {`Authorization: Bearer ${KEY}`}
            </pre>
          </div>
        </header>

        {ENDPOINTS.map((e) => (
          <section
            key={e.path}
            id={anchor(e)}
            className="scroll-mt-6 border-t border-stone-200 pt-10"
          >
            <div className="grid gap-8 xl:grid-cols-[1fr_minmax(0,26rem)]">
              {/* prose + parameters */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${METHOD_TONE[e.method]}`}
                  >
                    {e.method}
                  </span>
                  <code className="font-mono text-sm font-semibold text-stone-900">
                    {e.path}
                  </code>
                </div>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-stone-900">
                  {e.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-stone-500">
                  {e.description}
                </p>

                {e.params.length > 0 && (
                  <ParamList title={e.paramsTitle} params={e.params} />
                )}
                <ParamList title="Response fields" params={e.responseFields} />
              </div>

              {/* sticky code panel */}
              <div className="min-w-0">
                <div className="sticky top-6 space-y-3">
                  <CodeTabs tabs={e.request} />
                  <div>
                    <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">
                      Response
                    </div>
                    <pre className="max-h-72 overflow-auto rounded-xl bg-stone-900 p-3 font-mono text-[11px] leading-4 text-green-100/90">
                      {e.response}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ))}

        <p className="border-t border-stone-200 pt-6 text-[11px] leading-5 text-stone-400">
          Also available: <code className="font-mono">GET
          /v1/reviews/{"{id}"}/findings/{"{finding_id}"}/evidence</code> (the
          recorded evidence behind a finding) and{" "}
          <code className="font-mono">…/audit</code> (the append-only audit
          trail, replayed verbatim).
        </p>
      </div>
    </div>
  );
}

function ParamList({ title, params }: { title: string; params: Param[] }) {
  return (
    <div className="mt-6">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
        {title}
      </div>
      <ul className="mt-2 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
        {params.map((p) => (
          <li key={p.name} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <code className="font-mono text-xs font-semibold text-stone-900">
                {p.name}
              </code>
              <span className="font-mono text-[10px] text-stone-400">{p.type}</span>
              {p.required && (
                <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-medium text-red-600">
                  required
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-5 text-stone-500">{p.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
