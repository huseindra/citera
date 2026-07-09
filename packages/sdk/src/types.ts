// Wire types for the Citera REST API (/v1). Field names match the API
// responses exactly — the SDK is a thin, typed transport, never a place
// where regulatory logic lives.

export type DocumentKind = "icf" | "protocol" | "other";
export type DocumentStatus = "processing" | "ready" | "failed";
export type ReviewStatus = "pending" | "running" | "complete" | "failed";
export type FindingStatus =
  | "satisfied"
  | "partial"
  | "conflicting"
  | "not_found"
  | "evaluation_failed";
export type RulesetStatus = "available" | "in_development" | "roadmap";

export interface Document {
  id: string;
  filename: string;
  kind: string;
  status: DocumentStatus;
  status_reason: string | null;
  chunk_count: number;
  created_at: string;
}

export interface DocumentText {
  id: string;
  filename: string;
  canonical_text: string;
}

export interface Span {
  page: number | null;
  char_start: number;
  char_end: number;
}

export interface Finding {
  id: string;
  rule_id: string;
  rule_title: string | null;
  citation: string | null;
  severity: string | null;
  status: FindingStatus;
  reasoning: string;
  verbatim_quote: string | null;
  span: Span | null;
  evidence_strength: string | null;
  protocol_reference: string | null;
  queries_executed: string[] | null;
  suggested_revision: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  document_id: string;
  protocol_document_id: string | null;
  ruleset_id: string;
  ruleset_version: string;
  status: ReviewStatus;
  rule_count: number;
  generate_suggested_revision: boolean;
  evaluator_model: string | null;
  findings: Finding[];
  created_at: string;
}

export interface ReviewSummary {
  id: string;
  document_id: string;
  document_filename: string | null;
  ruleset_id: string;
  status: ReviewStatus;
  status_counts: Record<string, number>;
  created_at: string;
}

export interface Rule {
  id: string;
  citation: string;
  title: string;
  description: string;
  severity: string;
  statutory_refs: string[];
  remediation: string | null;
}

export interface Ruleset {
  id: string;
  name: string;
  version: string;
  authority: string;
  jurisdiction: string;
  languages: string[];
  rules: Rule[];
}

export interface RulesetInfo {
  id: string;
  authority: string;
  name: string;
  jurisdiction: string;
  coverage: string | null;
  status: RulesetStatus;
  version: string | null;
  rule_count: number | null;
  languages: string[];
  aliases: string[];
}

export interface CoverageRow {
  rule_id: string;
  rule_title: string;
  citation: string;
  severity: string;
  impact: string;
  status: FindingStatus | null;
  label: string;
  percent: number;
}

export interface Coverage {
  percent: number;
  passed: number;
  total: number;
  verdict: string;
  rows: CoverageRow[];
}

export interface ReviewReport {
  review: Review;
  document_filename: string | null;
  coverage: Coverage;
}

export interface Requirement {
  rule_id: string;
  title: string | null;
  citation: string | null;
  description: string | null;
  severity: string | null;
  impact: string | null;
  statutory_refs: string[];
  remediation: string | null;
}

export interface AuditStatus {
  span_verified: boolean;
  records: number;
}

export interface FindingDetail {
  id: string;
  review_id: string;
  ruleset_id: string;
  requirement: Requirement;
  status: FindingStatus;
  status_label: string;
  reasoning: string;
  verbatim_quote: string | null;
  span: Span | null;
  evidence_strength: string | null;
  protocol_reference: string | null;
  suggested_revision: string | null;
  audit: AuditStatus;
  created_at: string;
}
