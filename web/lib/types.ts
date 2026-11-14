// Data contracts: the API returns exactly these shapes (see docs/contracts.md, Round 3 section).
// Change a field => change the API and docs/contracts.md in the same commit.

export type AccessLabel = "public" | "contributor" | "lead_only";
export type Role = "lead" | "contributor" | "leaver" | "guest";

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
export type ReviewStatus = "pending" | "approved" | "edited" | "rejected" | "redacted" | "superseded";
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
  /** how the claim was produced: AI model, deterministic rules (no AI), or a person */
  method?: "model" | "rules" | "human";
}

export type ConflictResolution = "open" | "kept" | "both_true" | "corrected" | "deferred";
export type ConflictAction = "keep" | "both_true" | "correct" | "defer" | "reopen";

export interface ConflictEvidence {
  evidence_id: string;
  source_name: string | null;
  source_type: SourceType | null;
  author: string;
  ts: string;
  quote: string;
  locator: string;
}

export interface Conflict {
  id: string;
  claim_ids: string[];
  summary: string;
  resolution: ConflictResolution;
  resolved_by: string | null;
  note: string | null;
  entity_key: string;
  kind: "value" | "staleness" | "ownership";
  severity: "blocking" | "warning";
  detected_by: string;
  resolution_claim_id: string | null;
  decided_at: string | null;
  label?: AccessLabel;
  sides?: { claim: Claim; evidence: ConflictEvidence[] }[];
}

export interface ConflictEvent {
  at: string;
  actor: string;
  action: "detected" | "kept" | "both_true" | "corrected" | "deferred" | "reopened";
  note: string | null;
  payload: Record<string, unknown>;
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
  deferred_conflicts?: number;
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
  /** draft edit counter; `version` is the latest PUBLISHED version (0 = never published) */
  revision?: number;
  leaver_available?: boolean;
  is_demo?: boolean;
}

export type AckStatus = "none" | "acknowledged" | "unclear";

export interface ViewSection {
  key: SectionKey;
  title: string;
  claims: Claim[];
  ack: AckStatus;
  carried_over?: boolean;
  /** content changed since the version this reader last engaged with */
  changed?: boolean;
}

export interface SuccessorView {
  handover: Handover;
  sections: ViewSection[];
  hidden_count: number;
  version: number;
  draft: boolean;
  not_published: boolean;
  sha256: string | null;
  published_at?: string | null;
  last_ack_version: number;
  versions: number[];
  viewing_as?: Role;
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

/** One row of the tamper-evident audit log (GET /handovers/{id}/audit, newest first). */
export interface AuditEntry {
  seq?: number;
  role?: string;
  target_type?: string | null;
  target_id?: string | null;
  at: string;
  actor: string;
  action: string; // approve | edit | reject | redact | mark_sensitive | resolve_conflict | answer_gap | publish | ack | flag_unclear | create | upload | reconstruct | reset | ...
  summary: string;
  claim_id: string | null;
}

/** GET /handovers/{id}/versions/{a}/diff/{b} (b = 0: current draft, lead only). Role-filtered. */
export interface VersionDiff {
  from?: number;
  to?: number;
  added: Claim[];
  removed: Claim[];
  changed: {
    claim_id: string;
    section?: SectionKey;
    fields?: Record<string, { before: unknown; after: unknown }>;
    before: string | Partial<Claim>;
    after: string | Partial<Claim>;
    new_evidence?: number;
  }[];
  sections_changed?: SectionKey[];
  no_longer_visible?: number;
}

export interface PublishedVersion {
  version: number;
  published_at: string;
  published_by: string;
  sha256: string;
  summary: { claims?: number; revision?: number; note?: string };
}

export interface VersionsInfo {
  published: PublishedVersion[];
  draft: { revision: number; status: Handover["status"]; log: { revision: number | null; at: string; actor: string; action: string; summary: string; claim_id: string | null }[] } | null;
}

export type TaskStatus = "open" | "answered" | "resolved" | "wont_fix";
export interface Task {
  id: string;
  kind: "unclear_flag" | "successor_question" | "conflict_followup";
  section: SectionKey | null;
  claim_id: string | null;
  text: string;
  raised_by: string;
  raised_role: Role;
  assigned_to: "leaver" | "lead" | "both";
  status: TaskStatus;
  answer: string | null;
  answer_by: string | null;
  answer_evidence_id: string | null;
  resolution_note: string | null;
  version_raised: number;
  version_resolved: number | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationItem {
  key: string;
  label: string;
  count: number;
  tab: string;
}

export type PrivacyDecision = "pending" | "keep_masked" | "unmask" | "escalate_lead_only" | "added_manual";
export interface PrivacyItem {
  id: string;
  evidence_id: string;
  detector: string;
  detector_name: string;
  kind: "secret" | "pii" | "manual" | "suggestion";
  preview: string;
  decision: PrivacyDecision;
  decided_by: string | null;
  decided_at: string | null;
  reason: string | null;
  source_name: string | null;
  source_id: string | null;
  label: AccessLabel | null;
  author: string | null;
  ts: string | null;
  locator: string | null;
}

export interface AiStatus {
  mode: "auto" | "model" | "rules";
  model_configured: boolean;
  calls: { model?: number; rules?: number };
  recent_errors: string[];
}
