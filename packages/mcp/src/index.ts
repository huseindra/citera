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
  "explain_failure",
  {
    title: "Explain why a requirement fails",
    description:
      "Understand exactly why a finding fails its regulatory requirement: " +
      "the requirement, the span-verified evidence, the reason, and the " +
      "suggested direction for a compliant rewrite. Use this before " +
      "drafting a revision to submit with verify_revision.",
    inputSchema: {
      finding_id: z.string().describe("Finding id from a review's findings"),
    },
  },
  async (args) => {
    try {
      const dossier = await citera.findings.get(args.finding_id);
      const failing = dossier.status !== "satisfied";
      return ok({
        finding_id: dossier.id,
        review_id: dossier.review_id,
        requirement: {
          citation: dossier.requirement.citation,
          title: dossier.requirement.title,
          description: dossier.requirement.description,
          impact: dossier.requirement.impact,
          statutory_refs: dossier.requirement.statutory_refs,
        },
        evidence: {
          what_the_document_says: dossier.verbatim_quote,
          span: dossier.span,
          protocol_reference: dossier.protocol_reference,
          span_verified: dossier.audit.span_verified,
        },
        verdict: dossier.status_label,
        why: dossier.reasoning,
        suggested_direction: failing
          ? {
              remediation: dossier.requirement.remediation,
              ai_draft_revision: dossier.suggested_revision,
              note: "The draft is AI-generated and unverified — improve it, then prove it with verify_revision.",
            }
          : null,
        next_step: failing
          ? "Draft compliant replacement language and submit it with verify_revision(finding_id, revised_text)."
          : "This requirement is satisfied — no action needed.",
      });
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "verify_revision",
  {
    title: "Verify a proposed revision",
    description:
      "Prove whether your proposed consent language satisfies a failing " +
      "requirement. Citera judges the revision with the same evaluator and " +
      "byte-for-byte span-grounding gate as a full review, against the " +
      "study protocol. Returns Verified or Rejected with structured " +
      "reasoning. Rejected? Read the reasoning, revise, and resubmit — " +
      "iterate until Verified. Every attempt is recorded in the audit " +
      "trail; the original review is never rewritten.",
    inputSchema: {
      finding_id: z
        .string()
        .describe("The failing finding this revision addresses"),
      revised_text: z
        .string()
        .min(20)
        .describe("Your full proposed replacement section text"),
    },
  },
  async (args) => {
    try {
      const result = await citera.findings.verify(
        args.finding_id,
        args.revised_text,
      );
      const verified = result.verdict === "verified";
      return ok({
        verdict: verified ? "VERIFIED" : "REJECTED",
        attempt: result.attempt,
        requirement: {
          citation: result.requirement.citation,
          title: result.requirement.title,
        },
        engine_status: result.status_label,
        reasoning: result.reasoning,
        verified_quote: result.verified_quote,
        next_step: verified
          ? "Requirement satisfied by this revision. Run prepare_submission to see updated readiness."
          : "Revise the language to address the reasoning above, then resubmit with verify_revision.",
      });
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "prepare_submission",
  {
    title: "Prepare submission readiness",
    description:
      "Is this submission ready? Regulatory readiness with the " +
      "verification overlay: findings resolved by verified revisions are " +
      "labeled 'Resolved by Verified Revision' (the original review stays " +
      "immutable), plus remaining actions and the final verdict.",
    inputSchema: {
      review_id: z.string().describe("Review id"),
    },
  },
  async (args) => {
    try {
      const submission = await citera.reviews.submission(args.review_id);
      return ok({
        review_id: submission.review_id,
        final_verdict: submission.verdict,
        regulatory_readiness: {
          evidence_coverage_percent: submission.coverage.percent,
          requirements_passed: `${submission.coverage.passed} / ${submission.coverage.total}`,
        },
        evidence_matrix: submission.coverage.rows.map((row) => ({
          requirement: row.rule_title,
          citation: row.citation,
          impact: row.impact,
          status: row.label,
        })),
        resolved_by_verified_revision: submission.resolved_by_revision.map(
          (r) => ({
            finding_id: r.finding_id,
            requirement: r.rule_title,
            verified_on_attempt: r.attempt,
          }),
        ),
        remaining_actions: submission.remaining_actions.map((a) => ({
          finding_id: a.finding_id,
          requirement: a.rule_title,
          citation: a.citation,
          impact: a.impact,
          status: a.status_label,
          direction: a.remediation,
        })),
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
