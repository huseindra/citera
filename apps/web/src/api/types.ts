// Hand-written mirrors of the API DTOs (openapi-typescript arrives later).

export interface DocumentOut {
  id: string;
  filename: string;
  kind: "icf" | "protocol" | "other";
  status: "pending" | "processing" | "ready" | "failed";
  status_reason: string | null;
  chunk_count: number;
  created_at: string;
}

export interface DocumentText {
  id: string;
  filename: string;
  canonical_text: string;
}

export interface SpanOut {
  page: number | null;
  char_start: number;
  char_end: number;
}

export type FindingStatus =
  | "satisfied"
  | "partial"
  | "not_found"
  | "conflicting"
  | "evaluation_failed";

export interface FindingOut {
  id: string;
  rule_id: string;
  rule_title: string | null;
  citation: string | null;
  severity: "critical" | "major" | "minor" | null;
  status: FindingStatus;
  reasoning: string;
  verbatim_quote: string | null;
  span: SpanOut | null;
  evidence_strength: "strong" | "moderate" | "weak" | null;
  protocol_reference: string | null;
  queries_executed: string[] | null;
  suggested_revision: string | null;
  source: "engine" | "reviewer";
  reviewer_name: string | null;
  created_at: string;
}

export interface ReviewOut {
  id: string;
  document_id: string;
  protocol_document_id: string | null;
  ruleset_id: string;
  ruleset_version: string;
  status: "pending" | "running" | "complete" | "failed";
  rule_count: number;
  generate_suggested_revision: boolean;
  evaluator_model: string | null;
  title: string | null;
  notes: string | null;
  required_stages: number;
  findings: FindingOut[];
  created_at: string;
}

export interface RuleOut {
  id: string;
  citation: string;
  title: string;
  description: string;
  severity: string;
  statutory_refs: string[];
  remediation: string | null;
}

export interface RuleSetOut {
  id: string;
  name: string;
  version: string;
  rules: RuleOut[];
}

export interface RulesetInfo {
  id: string;
  authority: string;
  name: string;
  jurisdiction: string;
  coverage: string | null;
  status: "available" | "in_development" | "roadmap";
  version: string | null;
  rule_count: number | null;
  languages: string[];
  aliases: string[];
}

export interface EvidenceChunkOut {
  chunk_id: string;
  rank: number;
  section_title: string | null;
  char_start: number | null;
  char_end: number | null;
  text_preview: string | null;
  dense_score: number | null;
  sparse_score: number | null;
  fused_score: number;
}

export interface FindingEvidenceOut {
  finding_id: string;
  queries_executed: string[];
  fusion_params: Record<string, number>;
  embedding_model: string | null;
  results: EvidenceChunkOut[];
}

export interface AuditRecordOut {
  id: string;
  step: string;
  created_at: string;
  payload: Record<string, unknown>;
}

export interface FindingAuditOut {
  finding_id: string;
  rule_id: string;
  records: AuditRecordOut[];
}

export interface ApiKeyOut {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  revoked: boolean;
}

export interface ApiKeyCreated extends ApiKeyOut {
  key: string; // full secret — shown exactly once
}

export interface UsageSummary {
  plan: string;
  rate_limit_rpm: number;
  credits: { total: number; used: number; remaining: number };
  requests: {
    period_days: number;
    total: number;
    daily: { date: string; count: number }[];
  };
  recent: { operation: string; at: string }[];
}

export interface ReviewSummary {
  id: string;
  document_id: string;
  document_filename: string | null;
  ruleset_id: string;
  status: string;
  title: string | null;
  approved: boolean;
  status_counts: Record<string, number>;
  created_at: string;
}

// ------- staged reviewer workflow (Review 1..N + Verified stamp) -------

export interface DeterminationOut {
  id: string;
  stage_id: string;
  finding_id: string;
  rule_id: string | null;
  decision: "concur" | "override";
  comment: string | null;
  edited_text: string | null;
  reviewer_name: string;
  created_at: string;
}

export interface StageOut {
  id: string;
  stage_number: number;
  reviewer_name: string;
  status: "in_progress" | "completed";
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  determinations: DeterminationOut[];
}

export interface ApprovalOut {
  id: string;
  reviewer_name: string;
  content_hash: string;
  created_at: string;
}

export interface WorkflowOut {
  review_id: string;
  review_status: string;
  required_stages: number;
  completed_stages: number;
  stages: StageOut[];
  approval: ApprovalOut | null;
}
