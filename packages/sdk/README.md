# @citera/sdk

TypeScript SDK for **Citera — Clinical Regulatory Intelligence**.

A thin, typed client over the canonical REST API. Business logic lives in
the Review Engine; the SDK only moves bytes. The Playground, the REST API,
and the MCP server all return identical findings — only the transport
changes.

```
your app → @citera/sdk → REST → Review Engine
```

## Install

```bash
npm install @citera/sdk
```

Node 18+ (built on global `fetch`). Zero runtime dependencies.

## Quick start

```ts
import Citera from "@citera/sdk";

const citera = new Citera({ apiKey: process.env.CITERA_API_KEY });

const protocol = await citera.documents.upload({ file: protocolPdf, kind: "protocol" });
const icf      = await citera.documents.upload({ file: icfPdf, kind: "icf" });
await citera.documents.waitUntilReady(protocol.id);
await citera.documents.waitUntilReady(icf.id);

const review = await citera.reviews.create({
  document: icf.id,
  protocol: protocol.id,
  ruleset: "fda",
});

const result = await citera.reviews.waitUntilComplete(review.id);
for (const finding of result.findings) {
  // every quote is span-verified against the source document
  console.log(finding.status, finding.rule_title, finding.verbatim_quote);
}
```

## Surface

- `citera.documents` — `upload`, `get`, `list`, `text`, `waitUntilReady`
- `citera.reviews` — `create`, `get`, `list`, `waitUntilComplete`, `report`, `reportMarkdown`
- `citera.rulesets` — `list` (available / in development / roadmap), `get`
- `citera.findings` — `get` (full dossier: requirement, evidence, analysis, audit status)

## Configuration

| Option / env | Default | |
|---|---|---|
| `apiKey` / `CITERA_API_KEY` | — | Bearer token for `/v1` |
| `baseUrl` / `CITERA_BASE_URL` | `http://localhost:8000` | API origin |

## Build

```bash
npm install
npm run build
```
