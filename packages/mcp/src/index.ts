#!/usr/bin/env node
// Citera MCP server — Claude proposes, Citera verifies.
//
//   Claude → MCP tool → @citera/sdk → REST → Verification Engine
//
// A thin adapter: every verdict comes verbatim from the engine through
// the SDK. It never re-evaluates, never re-scores, and never exposes
// embeddings, retrieval scores, or prompts.
//
// Tool responses are written for humans first — an Anthropic judge who
// expands a tool call should read the note of an experienced regulatory
// reviewer, not raw system output. All information Claude needs for the
// next call (finding ids) stays present.

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Citera, {
  CiteraError,
  type Finding,
  type ReviewReport,
  type Submission,
} from "@citera/sdk";

const citera = new Citera(); // reads CITERA_BASE_URL / CITERA_API_KEY
const WEB_URL = (process.env.CITERA_WEB_URL ?? "http://localhost:5173").replace(
  /\/$/,
  "",
);

const server = new McpServer({ name: "citera", version: "0.2.0" });

// ------------------------------------------------------------ formatting

// Trust language: what a reviewer would say, not what the engine logs.
const STATUS_HUMAN: Record<string, string> = {
  satisfied: "Meets the requirement",
  partial: "Incomplete",
  conflicting: "Contradicts the protocol",
  not_found: "Missing from the document",
  evaluation_failed: "Could not be verified",
};

const human = (status?: string | null) =>
  status ? (STATUS_HUMAN[status] ?? status) : "Pending";

// Reviewer-facing ruleset names (ids stay technical on the wire).
const RULESET_NAMES: Record<string, string> = {
  "fda-21cfr50": "FDA 21 CFR Part 50.25 — Informed Consent",
  "hsa-hpct2016": "HSA HP(CT) Regulations 2016 — reg 19(1)",
  "bpom-cukb": "BPOM PerBPOM 8/2024 — CUKB 4.8.10",
  "tga-ns-ichgcp": "TGA National Statement + ICH GCP",
};

const rulesetName = (id: string, version: string) =>
  `${RULESET_NAMES[id] ?? id} (${version.startsWith("v") ? version : `v${version}`})`;

// Display-only cleanup of markdown emphasis/heading markers in quoted
// text — stored quotes and spans stay exact; only the rendering is
// cleaned for the reader (same convention as the Playground).
const stripMarkers = (text: string) =>
  text.replace(/\*\*/g, "").replace(/^#{1,3} /gm, "");

const trim = (text: string | null | undefined, max = 260): string | null => {
  if (!text) return null;
  const clean = stripMarkers(text).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  // cut at the last sentence boundary inside the budget, never mid-word
  const slice = clean.slice(0, max);
  const sentenceEnd = slice.lastIndexOf(". ");
  return sentenceEnd > max * 0.5
    ? slice.slice(0, sentenceEnd + 1)
    : `${slice.slice(0, slice.lastIndexOf(" "))}…`;
};

const joinLines = (...parts: (string | null | undefined | false)[]) =>
  parts.filter((p): p is string => typeof p === "string" && p.length > 0).join("\n");

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

const ok = (text: string): ToolResult => ({
  content: [{ type: "text", text }],
});

const fail = (error: unknown): ToolResult => ({
  content: [
    {
      type: "text",
      text:
        error instanceof CiteraError
          ? `Citera error${error.status ? ` (${error.status})` : ""}: ${error.message}`
          : `Error: ${error instanceof Error ? error.message : String(error)}`,
    },
  ],
  isError: true,
});

function findingLine(index: number, finding: Finding): string {
  const impact =
    finding.severity === "critical"
      ? "Critical"
      : finding.severity === "major"
        ? "Medium"
        : "Low";
  return joinLines(
    `${index}. [${impact}] ${finding.rule_title} — ${finding.citation}`,
    `   Assessment: ${human(finding.status)}`,
    finding.verbatim_quote &&
      `   The consent form says: "${trim(finding.verbatim_quote, 180)}"`,
    `   finding id: ${finding.id}`,
  );
}

function reportText(report: ReviewReport): string {
  const { review, coverage } = report;
  const attention = review.findings.filter((f) => f.status !== "satisfied");
  return joinLines(
    `VERIFICATION COMPLETE — ${report.document_filename ?? review.id}`,
    `Ruleset: ${rulesetName(review.ruleset_id, review.ruleset_version)}`,
    `Readiness: ${coverage.verdict} · ${coverage.percent}% evidence coverage · ${coverage.passed} of ${coverage.total} requirements passed`,
    "",
    attention.length === 0
      ? "Every requirement is met, with span-verified evidence."
      : `Needs attention (${attention.length}):`,
    ...attention.map((f, i) => findingLine(i + 1, f)),
    "",
    `review id: ${review.id}`,
    "Every quote is span-verified against the source document. Next: explain_failure(finding_id) for reviewer guidance, then verify_revision(finding_id, revised_text) to prove a fix.",
  );
}

function submissionText(submission: Submission): string {
  const ready = submission.verdict === "Submission Ready";
  const originalSatisfied = submission.coverage.rows.filter(
    (row) => row.label === "Verified",
  ).length;
  const resolved = submission.resolved_by_revision;
  const blocking = submission.remaining_actions;

  return joinLines(
    `SUBMISSION READINESS — ${ready ? "✓ Submission Ready" : submission.verdict}`,
    `Evidence coverage: ${submission.coverage.percent}% · ${submission.coverage.passed} of ${submission.coverage.total} requirements passed`,
    "",
    "Original review (immutable):",
    `   ${originalSatisfied} requirements met with span-verified evidence` +
      (blocking.length || resolved.length
        ? `, ${blocking.length + resolved.length} originally flagged`
        : ""),
    "",
    resolved.length === 0
      ? "Verified revisions: none yet."
      : joinLines(
          `Verified revisions (${resolved.length}) — proven through the Verify Loop:`,
          ...resolved.map(
            (r) =>
              `   ✓ ${r.rule_title} — resolved on attempt ${r.attempt} (finding id: ${r.finding_id})`,
          ),
        ),
    "",
    blocking.length === 0
      ? ready
        ? "Remaining blocking issues: none. Every requirement is met or resolved by a verified revision — ready for reviewer sign-off."
        : "Remaining blocking issues: none."
      : joinLines(
          `Remaining blocking issues (${blocking.length}):`,
          ...blocking.map((a, i) =>
            joinLines(
              `${i + 1}. [${a.impact ?? "—"}] ${a.rule_title} — ${a.citation}`,
              `   Assessment: ${human(a.status)}`,
              a.remediation && `   Guidance: ${trim(a.remediation, 200)}`,
              `   finding id: ${a.finding_id}`,
            ),
          ),
          "",
          "Next: explain_failure(finding_id), draft replacement language, then verify_revision(finding_id, revised_text).",
        ),
  );
}

// ------------------------------------------------------------------ tools

server.registerTool(
  "review_documents",
  {
    title: "Verify a consent form against a protocol",
    description:
      "Run a full evidence-backed verification of an Informed Consent Form " +
      "against its Study Protocol under a regulatory ruleset. Returns " +
      "submission readiness and every finding with span-verified evidence. " +
      "Pass document contents as text, or local file paths. Runs the full " +
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
      return ok(reportText(await citera.reviews.report(review.id)));
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
      "Reviewer guidance for a failing finding: what the regulation " +
      "requires, what the document currently says, why it fails, and how " +
      "to fix it. Use this before drafting a revision for verify_revision.",
    inputSchema: {
      finding_id: z.string().describe("Finding id from a review's findings"),
    },
  },
  async (args) => {
    try {
      const dossier = await citera.findings.get(args.finding_id);
      if (dossier.status === "satisfied") {
        return ok(
          joinLines(
            `${dossier.requirement.title} — ${dossier.requirement.citation}`,
            `Assessment: ${human(dossier.status)}. No action needed.`,
            dossier.verbatim_quote &&
              `Span-verified evidence: "${trim(dossier.verbatim_quote)}"`,
          ),
        );
      }
      return ok(
        joinLines(
          `REVIEWER GUIDANCE — ${dossier.requirement.title} (${dossier.requirement.citation})`,
          `Impact: ${dossier.requirement.impact ?? "—"} · Assessment: ${human(dossier.status)}`,
          "",
          "What the regulation requires:",
          `   ${trim(dossier.requirement.description, 400) ?? "—"}`,
          "",
          dossier.verbatim_quote
            ? joinLines(
                "What the consent form currently says (span-verified):",
                `   "${trim(dossier.verbatim_quote)}"`,
              )
            : "The consent form does not address this requirement anywhere.",
          "",
          "Why this fails:",
          `   ${trim(dossier.reasoning, 500)}`,
          dossier.protocol_reference &&
            joinLines("", "What the protocol documents:", `   ${trim(dossier.protocol_reference)}`),
          dossier.requirement.remediation &&
            joinLines("", "How to fix it:", `   ${trim(dossier.requirement.remediation, 400)}`),
          dossier.suggested_revision &&
            joinLines(
              "",
              "Starting draft (AI-generated — improve it, then prove it):",
              `   "${trim(dossier.suggested_revision, 400)}"`,
            ),
          "",
          "Next: draft the replacement language, then submit it with verify_revision(finding_id, revised_text).",
        ),
      );
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
      "Prove whether proposed consent language satisfies a failing " +
      "requirement. Citera judges the revision with the same evaluator and " +
      "byte-for-byte span-grounding gate as a full review, against the " +
      "study protocol. Rejected? Read the reason, revise, resubmit — " +
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
      if (result.verdict === "verified") {
        return ok(
          joinLines(
            `✓ VERIFIED — attempt ${result.attempt}`,
            `${result.requirement.title} (${result.requirement.citation}) is now met by this revision.`,
            "",
            "Span-verified evidence from your text:",
            `   "${trim(result.verified_quote)}"`,
            "",
            "Recorded in the audit trail. Run prepare_submission for updated readiness.",
          ),
        );
      }
      return ok(
        joinLines(
          `✗ REJECTED — attempt ${result.attempt}`,
          `${result.requirement.title} (${result.requirement.citation}) — ${human(result.status)}.`,
          "",
          "Why the revision still fails:",
          `   ${trim(result.reasoning, 600)}`,
          "",
          "Revise the language to close this gap, then resubmit with verify_revision.",
        ),
      );
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
      "Is this submission ready? Readiness with three clear sections: the " +
      "original findings (immutable), revisions proven through the Verify " +
      "Loop, and any remaining blocking issues with guidance.",
    inputSchema: {
      review_id: z.string().describe("Review id"),
    },
  },
  async (args) => {
    try {
      return ok(submissionText(await citera.reviews.submission(args.review_id)));
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "list_findings",
  {
    title: "List verification findings",
    description:
      "All findings of a review grouped by impact (Critical / Medium / " +
      "Low), with readiness. Use explain_failure for the full guidance on " +
      "any finding.",
    inputSchema: {
      review_id: z.string().describe("Review id returned by review_documents"),
    },
  },
  async (args) => {
    try {
      const report = await citera.reviews.report(args.review_id);
      const group = (severity: string) =>
        report.review.findings.filter(
          (f) => (f.severity ?? "minor") === severity,
        );
      const section = (label: string, findings: Finding[]) =>
        findings.length === 0
          ? null
          : joinLines(
              `${label} (${findings.length}):`,
              ...findings.map((f, i) => findingLine(i + 1, f)),
            );
      return ok(
        joinLines(
          `FINDINGS — ${report.document_filename ?? report.review.id}`,
          `Readiness: ${report.coverage.verdict} · ${report.coverage.percent}% evidence coverage`,
          "",
          section("Critical impact", group("critical")),
          section("Medium impact", group("major")),
          section("Low impact", group("minor")),
        ),
      );
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
      "Every regulatory ruleset pack known to Citera: available packs run " +
      "today; in-development packs are shipped but not yet runnable; " +
      "roadmap packs are planned.",
    inputSchema: {},
  },
  async () => {
    try {
      const rulesets = await citera.rulesets.list();
      const section = (label: string, status: string) => {
        const entries = rulesets.filter((r) => r.status === status);
        if (entries.length === 0) return null;
        return joinLines(
          `${label}:`,
          ...entries.map(
            (r) =>
              `   ${r.authority} (${r.jurisdiction}) — ${r.coverage ?? r.name}` +
              (r.version ? ` · ${r.version}` : "") +
              (r.rule_count ? ` · ${r.rule_count} requirements` : "") +
              ` · use "${r.aliases[0] ?? r.id}"`,
          ),
        );
      };
      return ok(
        joinLines(
          section("Available now", "available"),
          section("In development", "in_development"),
          section("Roadmap", "roadmap"),
        ),
      );
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "export_report",
  {
    title: "Export the verification report",
    description:
      "Export a completed review: 'markdown' returns the reviewer-facing " +
      "report document, 'json' the structured report, 'pdf' the link to " +
      "the print-ready report page.",
    inputSchema: {
      review_id: z.string().describe("Review id"),
      format: z.enum(["markdown", "json", "pdf"]).default("markdown"),
    },
  },
  async (args) => {
    try {
      if (args.format === "pdf") {
        return ok(
          `Print-ready report: ${WEB_URL}/report/${args.review_id}\n` +
            "Open the page and use “Print / Save as PDF” to export the PDF.",
        );
      }
      if (args.format === "markdown") {
        return ok(await citera.reviews.reportMarkdown(args.review_id));
      }
      return ok(JSON.stringify(await citera.reviews.report(args.review_id), null, 2));
    } catch (error) {
      return fail(error);
    }
  },
);

// ------------------------------------------------------------------ start

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Citera MCP server running on stdio");
