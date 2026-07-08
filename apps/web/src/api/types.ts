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
  evaluator_model: string | null;
  findings: FindingOut[];
  created_at: string;
}

export interface RuleOut {
  id: string;
  citation: string;
  title: string;
  description: string;
  severity: string;
}

export interface RuleSetOut {
  id: string;
  name: string;
  version: string;
  rules: RuleOut[];
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

export interface SemanticPoint {
  chunk_id: string;
  x: number;
  y: number;
  section_title: string | null;
  char_start: number;
  char_end: number;
  preview: string;
}

export interface SemanticMapOut {
  document_id: string;
  points: SemanticPoint[];
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

export interface ReviewSummary {
  id: string;
  document_id: string;
  document_filename: string | null;
  ruleset_id: string;
  status: string;
  status_counts: Record<string, number>;
  created_at: string;
}
