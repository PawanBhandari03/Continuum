// Data contracts — mirror of HANDOFF_FOR_RAHUL.md section 6 (see docs/contracts.md).
// Pawan's API returns exactly these shapes. Change a field => tell Pawan + edit docs/contracts.md.

export type AccessLabel = "public" | "contributor" | "lead_only";
export type Role = "lead" | "contributor" | "leaver";

export type SourceType = "github" | "chat_export" | "notes" | "issues" | "exit_qa";
export type SourceStatus = "ok" | "partial" | "failed" | "pending";

export interface Source {
  id: string;
  type: SourceType;
  name: string;
  status: SourceStatus;
  status_reason: string | null;
  default_label: AccessLabel;
  unit_count: number;
}

export interface Redaction {
  start: number;
  end: number;
  kind: "secret" | "pii" | "manual";
}

export interface EvidenceUnit {
  id: string;
  source_id: string;
  author: string;
  timestamp: string;
  text: string;
  locator: string;
  label: AccessLabel;
  redactions: Redaction[];
}

export type ClaimType =
  | "decision"
  | "risk"
  | "dependency"
  | "owner"
  | "next_action"
  | "open_question"
  | "fact"
  | "gap";

export type EvidenceState = "verified" | "inferred" | "conflicting" | "missing" | "confirmed";
export type ReviewStatus = "pending" | "approved" | "edited" | "rejected" | "redacted";
export type SectionKey =
  | "project"
  | "state"
  | "decision_log"
  | "first_week"
  | "risks"
  | "dependencies"
  | "unresolved";

export interface Citation {
  evidence_id: string;
  quote: string;
  support: "full" | "partial";
}

export interface Claim {
  id: string;
  handover_id: string;
  type: ClaimType;
  statement: string;
  state: EvidenceState;
  confidence_reason: string;
  workstream: string;
  entity_key: string;
  owner: string | null;
  label: AccessLabel;
  review_status: ReviewStatus;
  sensitive: boolean;
  section: SectionKey;
  date: string | null;
  citations: Citation[];
  conflict_id: string | null;
  version: number;
  confirmed_by: string | null;
  confirmed_at: string | null;
}

export type ConflictResolution = "open" | "resolved" | "unresolved_followup";

export interface Conflict {
  id: string;
  claim_ids: string[];
  summary: string;
  resolution: ConflictResolution;
  resolved_by: string | null;
  note: string | null;
}

export interface Gap {
  id: string;
  claim_id: string;
  question: string;
  evidence_found: string[];
  status: "open" | "answered" | "skipped";
  answer: string | null;
  answer_evidence_id: string | null;
}

export interface Readiness {
  score: number;
  formula: string;
  slots_filled: number;
  slots_total: number;
  open_conflicts: number;
  open_gaps: number;
}

export interface Handover {
  id: string;
  leaver: string;
  successor: string;
  successor_role: "contributor" | "lead";
  target_date: string;
  status: "draft" | "in_review" | "published";
  version: number;
  approved_by: string | null;
  published_at: string | null;
}

export type AckStatus = "none" | "acknowledged" | "unclear";

export interface ViewSection {
  key: SectionKey;
  title: string;
  claims: Claim[];
  ack: AckStatus;
}

export interface SuccessorView {
  handover: Handover;
  sections: ViewSection[];
  hidden_count: number;
}

export type ReviewActionKind =
  | "approve"
  | "edit"
  | "reject"
  | "redact"
  | "mark_sensitive"
  | "ack"
  | "flag_unclear";

export interface ReviewAction {
  id: string;
  claim_id: string;
  actor: string;
  action: ReviewActionKind;
  before: unknown;
  after: unknown;
  at: string;
}

export interface VersionEntry {
  version: number;
  at: string;
  actor: string;
  summary: string;
}

export interface JobStatus {
  status: "queued" | "running" | "done" | "failed";
  stage: "parse" | "protect" | "extract" | "verify" | "conflicts_gaps" | null;
  progress: number; // 0..100
  error: string | null;
}

export interface EvidenceDetail {
  citation: Citation;
  unit: EvidenceUnit;
  source: Source;
  context: EvidenceUnit[]; // neighbouring units in time order (includes `unit`)
}

export interface PublishResult {
  ok: boolean;
  reasons: string[];
}

/** One row of the review/audit log (GET /handovers/{id}/audit, newest first). */
export interface AuditEntry {
  at: string;
  actor: string;
  action: string; // approve | edit | reject | redact | mark_sensitive | resolve_conflict | answer_gap | publish | ack | flag_unclear | create | upload | reconstruct | reset | ...
  summary: string;
  claim_id: string | null;
}

/** GET /handovers/{id}/versions/{a}/diff/{b}. `before`/`after` may be the claim text or a partial claim; the UI accepts both. */
export interface VersionDiff {
  added: Claim[];
  removed: Claim[];
  changed: { claim_id: string; before: string | Partial<Claim>; after: string | Partial<Claim> }[];
}
