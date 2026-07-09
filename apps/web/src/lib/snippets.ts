// SDK / API example snippets, parametrized by key so copied code runs.

const KEY = "$CITERA_API_KEY";

export const CURL_EXAMPLE = `# 1. upload both documents
curl -s http://localhost:8000/v1/documents \\
  -H "Authorization: Bearer ${KEY}" \\
  -F "file=@protocol.pdf" -F "kind=protocol"

# 2. start an evidence-verified review
curl -s http://localhost:8000/v1/reviews \\
  -H "Authorization: Bearer ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{"document_id": "<icf-id>", "protocol_document_id": "<protocol-id>"}'

# 3. read the findings
curl -s http://localhost:8000/v1/reviews/<review-id> \\
  -H "Authorization: Bearer ${KEY}"`;

export const TS_EXAMPLE = `import Citera from "@citera/sdk";

const citera = new Citera({ apiKey: process.env.CITERA_API_KEY });

const protocol = await citera.documents.upload({ file: protocolPdf, kind: "protocol" });
const icf      = await citera.documents.upload({ file: icfPdf, kind: "icf" });

const review = await citera.reviews.create({
  document: icf.id,
  protocol: protocol.id,
  ruleset: "fda",
});

const result = await citera.reviews.waitUntilComplete(review.id);
for (const finding of result.findings) {
  // every quote is span-verified against the source document
  console.log(finding.status, finding.rule_title, finding.verbatim_quote);
}`;

export const REST_EXAMPLE = `POST /v1/documents
Authorization: Bearer ${KEY}
Content-Type: multipart/form-data
  file=@icf.pdf  kind=icf

POST /v1/reviews
Authorization: Bearer ${KEY}
Content-Type: application/json
{
  "ruleset": "fda",
  "document_id": "<icf-id>",
  "protocol_document_id": "<protocol-id>",
  "generate_suggested_revision": true
}

GET /v1/reviews/{review_id}
-> { "status": "complete", "findings": [ ... ] }`;

export const PYTHON_COMING_SOON = `# Python SDK — coming soon.
#
# The REST API works from Python today:
#
#   import requests
#   requests.post(
#       "http://localhost:8000/v1/reviews",
#       headers={"Authorization": f"Bearer {KEY}"},
#       json={"ruleset": "fda", "document_id": icf_id,
#             "protocol_document_id": protocol_id},
#   )`;

export const PY_EXAMPLE = `from citera import Citera

citera = Citera()  # reads CITERA_API_KEY

protocol = citera.documents.upload(file="protocol.pdf", kind="protocol")
icf = citera.documents.upload(file="icf.pdf", kind="icf")

review = citera.reviews.create(
    document=icf.id, protocol=protocol.id, ruleset="fda",
)
result = review.wait_until_complete()

for finding in result.findings:
    print(finding.status, finding.rule_title, finding.verbatim_quote)`;

export const INSTALL_NPM = "npm install @citera/sdk";
export const INSTALL_PIP = "pip install citera";
