#!/usr/bin/env node
// Citera MCP server — the third interface to the same Review Engine.
//
//   Claude → MCP tool → @citera/sdk → REST → Review Engine
//
// This layer only adapts domain tools to MCP; every finding it returns
// comes verbatim from the engine through the SDK. It never re-evaluates,
// never re-scores, and never exposes embeddings, retrieval scores, or
// prompts — the same product rule the Playground follows.

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Citera, { CiteraError, type Finding, type ReviewReport } from "@citera/sdk";

const citera = new Citera(); // reads CITERA_BASE_URL / CITERA_API_KEY
const WEB_URL = (process.env.CITERA_WEB_URL ?? "http://localhost:5173").replace(
  /\/$/,
  "",
);

const server = new McpServer({ name: "citera", version: "0.1.0" });

// ---------------------------------------------------------------- helpers

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

const ok = (payload: unknown): ToolResult => ({
  content: [
    {
      type: "text",
      text:
        typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
    },
  ],
});

const fail = (error: unknown): ToolResult => ({
  content: [
    {
      type: "text",
      text:
        error instanceof CiteraError
          ? `Citera API error${error.status ? ` (${error.status})` : ""}: ${error.message}`
          : `Error: ${error instanceof Error ? error.message : String(error)}`,
    },
  ],
  isError: true,
});

/** Reviewer-facing view of a finding — evidence, never internals. */
function findingView(finding: Finding) {
  return {
    finding_id: finding.id,
    requirement: finding.rule_title,
    citation: finding.citation,
    severity: finding.severity,
    status: finding.status,
    analysis: finding.reasoning,
    verified_evidence: finding.verbatim_quote,
    protocol_reference: finding.protocol_reference,
    suggested_revision: finding.suggested_revision,
  };
}

function reportView(report: ReviewReport) {
  const { review, coverage } = report;
  return {
    review_id: review.id,
    document: report.document_filename,
    ruleset: `${review.ruleset_id} (v${review.ruleset_version})`,
    regulatory_readiness: {
      verdict: coverage.verdict,
      evidence_coverage_percent: coverage.percent,
      requirements_passed: `${coverage.passed} / ${coverage.total}`,
    },
    evidence_matrix: coverage.rows.map((row) => ({
      requirement: row.rule_title,
      citation: row.citation,
      impact: row.impact,
      status: row.label,
    })),
    findings_requiring_attention: review.findings
      .filter((f) => f.status !== "satisfied")
      .map(findingView),
    note: "Every verified_evidence quote is span-verified byte-for-byte against the source document. suggested_revision fields are AI drafts and require reviewer sign-off.",
  };
}

// ------------------------------------------------------------------ tools

server.registerTool(
  "review_documents",
  {
    title: "Review clinical documents",
    description:
      "Review a Study Protocol and Informed Consent Form (ICF) against a " +
      "regulatory ruleset using the Citera Review Engine. Returns the " +
      "review summary, regulatory readiness, the evidence matrix, and " +
      "every finding with span-verified evidence. Pass document contents " +
      "as text, or local file paths. Runs the full evidence-verified " +
      "pipeline — typically 1–3 minutes.",
    inputSchema: {
      protocol_text: z
        .string()
        .optional()
        .describe("Full text of the study protocol (markdown or plain text)"),
      protocol_path: z
        .string()
        .optional()
        .describe("Local file path of the study protocol (.md/.txt/.pdf/.docx)"),
      icf_text: z
        .string()
        .optional()
        .describe("Full text of the informed consent form"),
      icf_path: z
        .string()
        .optional()
        .describe("Local file path of the informed consent form"),
      ruleset: z
        .string()
        .default("fda")
        .describe(
          "Ruleset id or alias: fda (21 CFR 50.25), hsa, bpom, tga — " +
            "see list_rulesets for availability",
        ),
    },
  },
  async (args) => {
    try {
      const load = async (
        text: string | undefined,
        path: string | undefined,
        role: string,
      ) => {
        if (text) return { file: text, filename: `${role}.md` };
        if (path) return { file: await readFile(path), filename: basename(path) };
        throw new Error(`Provide ${role}_text or ${role}_path`);
      };
      const protocolInput = await load(
        args.protocol_text,
        args.protocol_path,
        "protocol",
      );
      const icfInput = await load(args.icf_text, args.icf_path, "icf");

      const [protocol, icf] = await Promise.all([
        citera.documents.upload({ ...protocolInput, kind: "protocol" }),
        citera.documents.upload({ ...icfInput, kind: "icf" }),
      ]);
      await Promise.all([
        citera.documents.waitUntilReady(protocol.id),
        citera.documents.waitUntilReady(icf.id),
      ]);

      const review = await citera.reviews.create({
        document: icf.id,
        protocol: protocol.id,
        ruleset: args.ruleset,
      });
      await citera.reviews.waitUntilComplete(review.id);
      return ok(reportView(await citera.reviews.report(review.id)));
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "list_rulesets",
  {
    title: "List regulatory rulesets",
    description:
      "List every regulatory ruleset pack known to Citera, grouped by " +
      "status: available (runnable today), in development (shipped but " +
      "not yet runnable), and roadmap (planned).",
    inputSchema: {},
  },
  async () => {
    try {
      const rulesets = await citera.rulesets.list();
      const view = (status: string) =>
        rulesets
          .filter((r) => r.status === status)
          .map((r) => ({
            id: r.id,
            aliases: r.aliases,
            authority: r.authority,
            name: r.name,
            jurisdiction: r.jurisdiction,
            coverage: r.coverage,
            version: r.version,
            rule_count: r.rule_count,
            languages: r.languages,
          }));
      return ok({
        available: view("available"),
        in_development: view("in_development"),
        roadmap: view("roadmap"),
      });
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "get_finding",
  {
    title: "Get finding dossier",
    description:
      "Full dossier for a single finding: the regulatory requirement, " +
      "reviewer impact, span-verified evidence, analysis, suggested " +
      "revision (AI draft), and audit status.",
    inputSchema: {
      finding_id: z.string().describe("Finding id from a review's findings"),
    },
  },
  async (args) => {
    try {
      const dossier = await citera.findings.get(args.finding_id);
      return ok({
        finding_id: dossier.id,
        review_id: dossier.review_id,
        ruleset: dossier.ruleset_id,
        requirement: {
          citation: dossier.requirement.citation,
          title: dossier.requirement.title,
          description: dossier.requirement.description,
          impact: dossier.requirement.impact,
          statutory_refs: dossier.requirement.statutory_refs,
          remediation: dossier.requirement.remediation,
        },
        status: dossier.status,
        status_label: dossier.status_label,
        analysis: dossier.reasoning,
        evidence_ledger: {
          verified_quote: dossier.verbatim_quote,
          span: dossier.span,
          evidence_strength: dossier.evidence_strength,
          protocol_reference: dossier.protocol_reference,
        },
        suggested_revision: dossier.suggested_revision,
        audit_status: {
          span_verified: dossier.audit.span_verified,
          audit_records: dossier.audit.records,
        },
      });
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "list_findings",
  {
    title: "List review findings",
    description:
      "All findings of a review, grouped by reviewer impact (Critical / " +
      "Medium / Low) with regulatory readiness. Use get_finding for the " +
      "full dossier of any finding.",
    inputSchema: {
      review_id: z.string().describe("Review id returned by review_documents"),
    },
  },
  async (args) => {
    try {
      const report = await citera.reviews.report(args.review_id);
      const bySeverity = (severity: string) =>
        report.review.findings
          .filter((f) => (f.severity ?? "minor") === severity)
          .map(findingView);
      return ok({
        review_id: report.review.id,
        regulatory_readiness: {
          verdict: report.coverage.verdict,
          evidence_coverage_percent: report.coverage.percent,
          requirements_passed: `${report.coverage.passed} / ${report.coverage.total}`,
        },
        findings: {
          critical: bySeverity("critical"),
          major: bySeverity("major"),
          minor: bySeverity("minor"),
        },
      });
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "export_report",
  {
    title: "Export review report",
    description:
      "Export a completed review as a report: 'markdown' returns the " +
      "reviewer-facing report document, 'json' returns the structured " +
      "report, 'pdf' returns the link to the print-ready report page.",
    inputSchema: {
      review_id: z.string().describe("Review id"),
      format: z.enum(["markdown", "json", "pdf"]).default("markdown"),
    },
  },
  async (args) => {
    try {
      if (args.format === "pdf") {
        // PDF is produced by the print-ready report page — link, don't fake
        return ok(
          `Print-ready report: ${WEB_URL}/report/${args.review_id}\n` +
            "Open the page and use “Print / Save as PDF” to export the PDF.",
        );
      }
      if (args.format === "markdown") {
        return ok(await citera.reviews.reportMarkdown(args.review_id));
      }
      return ok(await citera.reviews.report(args.review_id));
    } catch (error) {
      return fail(error);
    }
  },
);

// ------------------------------------------------------------------ start

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Citera MCP server running on stdio");
