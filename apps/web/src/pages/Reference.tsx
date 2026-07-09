// API Reference — simple, hand-written documentation of the real REST
// surface (no generated Swagger). Every endpoint: description, request,
// response, and the SDK spelling. Documents what exists today, nothing
// aspirational.

import { CodeTabs } from "../components/platform/CodeTabs";

interface Endpoint {
  method: string;
  path: string;
  title: string;
  description: string;
  request: string;
  response: string;
  sdk: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: "POST",
    path: "/v1/documents",
    title: "Upload a document",
    description:
      "Uploads and ingests a study document (protocol or ICF). The text is canonicalized, chunked with exact character spans, and indexed for evidence retrieval. Returns when the document is ready for review.",
    request: `Content-Type: multipart/form-data

file:  protocol.pdf | icf.md | .docx | .txt
kind:  "protocol" | "icf"`,
    response: `{
  "id": "9c2e…",
  "filename": "icf.md",
  "kind": "icf",
  "status": "ready",
  "chunk_count": 17
}`,
    sdk: `const icf = await citera.documents.upload({
  file: icfFile,
  kind: "icf",
});`,
  },
  {
    method: "POST",
    path: "/v1/reviews",
    title: "Start a review",
    description:
      "Runs an evidence-verified regulatory review of an ICF against a study protocol and a ruleset. Accepts the ruleset id or its short alias (fda, hsa, bpom, tga). Returns 202 immediately; findings stream in as each requirement is evaluated.",
    request: `Content-Type: application/json

{
  "ruleset": "fda",
  "document_id": "<icf-id>",
  "protocol_document_id": "<protocol-id>",
  "generate_suggested_revision": true
}`,
    response: `202 Accepted
{
  "id": "5b1a…",
  "status": "pending",
  "ruleset_id": "fda-21cfr50",
  "ruleset_version": "1.0.0",
  "rule_count": 8,
  "findings": []
}`,
    sdk: `const review = await citera.reviews.create({
  ruleset: "fda",
  document: icf.id,
  protocol: protocol.id,
});`,
  },
  {
    method: "GET",
    path: "/v1/reviews/{review_id}",
    title: "Read findings",
    description:
      "Returns the review with its findings: status per requirement, the span-verified quote (with character offsets into the source document), evidence strength, the AI-drafted suggested revision, and citations back to the statute. Poll until status is complete.",
    request: `GET /v1/reviews/5b1a…`,
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
      "suggested_revision": "…",
      "reasoning": "…"
    }
  ]
}`,
    sdk: `const result = await citera.reviews.waitUntilComplete(review.id);
for (const finding of result.findings) {
  console.log(finding.status, finding.verbatim_quote);
}`,
  },
  {
    method: "GET",
    path: "/v1/rulesets",
    title: "List rulesets",
    description:
      "Every regulatory authority is a pluggable, independently versioned ruleset. Lists available packs (runnable), in-development packs, and the roadmap. GET /v1/rulesets/{id} returns the full rule list with statutory references.",
    request: `GET /v1/rulesets`,
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
    sdk: `const rulesets = await citera.rulesets.list();`,
  },
];

const METHOD_TONE: Record<string, string> = {
  GET: "bg-sky-50 text-sky-600",
  POST: "bg-blue-100/70 text-blue-700",
};

export function ReferencePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 pb-16 pt-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">
          API Reference
        </h1>
        <p className="mt-1 max-w-xl text-sm leading-6 text-stone-500">
          The complete review workflow is four endpoints. Authenticate with{" "}
          <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[11px]">
            Authorization: Bearer $CITERA_API_KEY
          </code>
          . Everything shown in the Playground is built on these calls.
        </p>
      </div>

      <nav className="rounded-xl border border-stone-200 bg-white p-3">
        <ul className="space-y-1">
          {ENDPOINTS.map((e) => (
            <li key={e.path}>
              <a
                href={`#${anchor(e)}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-stone-50"
              >
                <MethodChip method={e.method} />
                <code className="font-mono text-stone-700">{e.path}</code>
                <span className="ml-auto text-stone-400">{e.title}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {ENDPOINTS.map((e) => (
        <section
          key={e.path}
          id={anchor(e)}
          className="scroll-mt-6 rounded-2xl border border-stone-200 bg-white p-5"
        >
          <div className="flex items-center gap-2">
            <MethodChip method={e.method} />
            <code className="font-mono text-sm font-semibold text-stone-900">
              {e.path}
            </code>
          </div>
          <h2 className="mt-2 text-sm font-semibold text-stone-800">{e.title}</h2>
          <p className="mt-1 text-xs leading-5 text-stone-500">{e.description}</p>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">
                Request
              </div>
              <pre className="overflow-x-auto rounded-lg bg-stone-900 p-3 text-[11px] leading-4 text-stone-100">
                {e.request}
              </pre>
            </div>
            <div>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">
                Response
              </div>
              <pre className="overflow-x-auto rounded-lg bg-stone-900 p-3 text-[11px] leading-4 text-green-100/90">
                {e.response}
              </pre>
            </div>
          </div>

          <div className="mt-3">
            <CodeTabs tabs={[{ label: "SDK (TypeScript)", code: e.sdk }]} />
          </div>
        </section>
      ))}

      <p className="text-[11px] leading-5 text-stone-400">
        Also available: <code className="font-mono">GET
        /v1/reviews/{"{id}"}/findings/{"{finding_id}"}/evidence</code> (the
        recorded evidence behind a finding) and <code className="font-mono">
        …/audit</code> (the append-only audit trail, replayed verbatim).
      </p>
    </div>
  );
}

function anchor(e: Endpoint): string {
  return `${e.method}-${e.path}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function MethodChip({ method }: { method: string }) {
  return (
    <span
      className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold ${METHOD_TONE[method] ?? "bg-stone-100 text-stone-600"}`}
    >
      {method}
    </span>
  );
}
