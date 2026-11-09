// Synthetic CampusKart fixture. ALL data is fake: secrets, phones and names are placeholders.
// Mirrors the planted facts in HANDOFF_FOR_RAHUL.md section 8.
import type {
  Claim,
  Conflict,
  EvidenceUnit,
  AuditEntry,
  Gap,
  Handover,
  Source,
  VersionEntry,
} from "@/lib/types";

const REPO = "https://github.com/campuskart-demo/campuskart";

export const handover: Handover = {
  id: "h_1",
  leaver: "aditi",
  successor: "karan",
  successor_role: "contributor",
  target_date: "2026-11-30",
  status: "in_review",
  version: 3,
  approved_by: null,
  published_at: null,
};

export const sources: Source[] = [
  { id: "src_gh", type: "github", name: "CampusKart repo (commits, PRs, README)", status: "ok", status_reason: null, default_label: "contributor", unit_count: 148 },
  { id: "src_chat", type: "chat_export", name: "Team chat export (#general, #dev, #payments)", status: "ok", status_reason: null, default_label: "contributor", unit_count: 312 },
  { id: "src_notes", type: "notes", name: "Project notes (architecture.md, onboarding.md)", status: "ok", status_reason: null, default_label: "contributor", unit_count: 41 },
  { id: "src_issues", type: "issues", name: "GitHub Issues board", status: "partial", status_reason: "Rate limited after 60 issues; 22 older issues were not fetched.", default_label: "contributor", unit_count: 60 },
  { id: "src_mentor", type: "notes", name: "Mentor notes (Prof. Iyer) — lead only", status: "ok", status_reason: null, default_label: "lead_only", unit_count: 3 },
  { id: "src_exit", type: "exit_qa", name: "Exit Q&A (leaver answers)", status: "ok", status_reason: null, default_label: "contributor", unit_count: 0 },
];

const MENTOR_TEXT =
  "Candid feedback for the lead only: Dev often misses deadlines and needs closer supervision. Test key sk_test_FAKE_51abcDEF0123456789 is in the shared sheet. Call me on +91-00000-00000.";

export const evidence: EvidenceUnit[] = [
  { id: "ev_readme", source_id: "src_gh", author: "aditi", timestamp: "2026-07-20T09:00:00Z", text: "CampusKart is a campus marketplace where students buy and sell second-hand items. Deployment: the app is deployed on Render (see render.yaml).", locator: `${REPO}/blob/main/README.md`, label: "contributor", redactions: [] },
  { id: "ev_chat_kyc", source_id: "src_chat", author: "rohan", timestamp: "2026-08-12T16:40:00Z", text: "gateway wale ne KYC maanga hai, merchant account ke bina live nahi jayega. Kya karein?", locator: "slack://payments/2026-08-12#1", label: "contributor", redactions: [] },
  { id: "ev_chat_upi", source_id: "src_chat", author: "aditi", timestamp: "2026-08-12T16:55:00Z", text: "bhai payment wala PR merge kar diya, UPI hi chalega abhi. KYC ke chakkar mein nahi padna.", locator: "slack://payments/2026-08-12#2", label: "contributor", redactions: [] },
  { id: "ev_pr87", source_id: "src_gh", author: "aditi", timestamp: "2026-08-14T10:22:00Z", text: "PR #87: Move payments from the card gateway to UPI deep links. The card gateway needs merchant KYC, which we cannot get as a student club.", locator: `${REPO}/pull/87`, label: "contributor", redactions: [] },
  { id: "ev_chat_bucket", source_id: "src_chat", author: "meera", timestamp: "2026-08-25T11:05:00Z", text: "image uploads ab third-party bucket pe ja rahe hain. Bucket ka credential sirf mere paas hai, kisi ko chahiye to mujhse lena.", locator: "slack://dev/2026-08-25#4", label: "contributor", redactions: [] },
  { id: "ev_chat_smtp", source_id: "src_chat", author: "meera", timestamp: "2026-09-02T13:15:00Z", text: "verification emails college SMTP account se ja rahe hain. Password mere paas nahi hai, pata nahi kisne setup kiya tha.", locator: "slack://dev/2026-09-02#7", label: "contributor", redactions: [] },
  { id: "ev_notes_smtp", source_id: "src_notes", author: "aditi", timestamp: "2026-09-10T08:30:00Z", text: "Auth: sign-up verification emails are sent through the college SMTP account (smtp.example.edu).", locator: "notes://architecture.md#auth", label: "contributor", redactions: [] },
  { id: "ev_win1", source_id: "src_chat", author: "dev", timestamp: "2026-09-05T18:20:00Z", text: "build fails on Windows path again (long path inside node_modules). Works on Linux.", locator: "slack://dev/2026-09-05#11", label: "contributor", redactions: [] },
  { id: "ev_win2", source_id: "src_chat", author: "rohan", timestamp: "2026-09-19T12:10:00Z", text: "same thing, build fails on Windows path. Someone please look at this?", locator: "slack://dev/2026-09-19#3", label: "contributor", redactions: [] },
  { id: "ev_win3", source_id: "src_chat", author: "meera", timestamp: "2026-10-14T19:45:00Z", text: "third time now — build fails on Windows path. Still no fix.", locator: "slack://dev/2026-10-14#9", label: "contributor", redactions: [] },
  { id: "ev_vercel", source_id: "src_gh", author: "dev", timestamp: "2026-10-02T14:00:00Z", text: "chore: add vercel.json and configure the Vercel project for the frontend deploy.", locator: `${REPO}/commit/9f3c2ab`, label: "contributor", redactions: [] },
  { id: "ev_pr91", source_id: "src_gh", author: "aditi", timestamp: "2026-10-09T17:30:00Z", text: "PR #91: temporary fix for login loop — clears the session cookie on redirect. TODO: proper fix in auth/session.ts.", locator: `${REPO}/pull/91`, label: "contributor", redactions: [] },
  { id: "ev_todo", source_id: "src_gh", author: "aditi", timestamp: "2026-10-09T17:28:00Z", text: "// TODO: remove this hack once refresh token rotation is implemented (auth/session.ts)", locator: `${REPO}/blob/main/auth/session.ts#L42`, label: "contributor", redactions: [] },
  { id: "ev_pr94", source_id: "src_issues", author: "rohan", timestamp: "2026-10-18T10:00:00Z", text: "PR #94: Add seller dashboard. Changes requested by aditi on 2026-10-19. No activity since.", locator: `${REPO}/pull/94`, label: "contributor", redactions: [] },
  { id: "ev_cod1", source_id: "src_chat", author: "rohan", timestamp: "2026-10-20T15:00:00Z", text: "COD rakhein ya nahi? returns handle karna mushkil hai.", locator: "slack://general/2026-10-20#2", label: "contributor", redactions: [] },
  { id: "ev_cod2", source_id: "src_chat", author: "meera", timestamp: "2026-10-20T15:12:00Z", text: "no decision yet. Let's discuss at the next meeting.", locator: "slack://general/2026-10-20#3", label: "contributor", redactions: [] },
  {
    id: "ev_mentor1", source_id: "src_mentor", author: "prof.iyer", timestamp: "2026-10-30T09:00:00Z", text: MENTOR_TEXT, locator: "notes://mentor-notes.md#feedback", label: "lead_only",
    redactions: [
      { start: MENTOR_TEXT.indexOf("sk_test"), end: MENTOR_TEXT.indexOf("sk_test") + "sk_test_FAKE_51abcDEF0123456789".length, kind: "secret" },
      { start: MENTOR_TEXT.indexOf("+91"), end: MENTOR_TEXT.indexOf("+91") + "+91-00000-00000".length, kind: "pii" },
    ],
  },
];

function cl(p: Partial<Claim> & Pick<Claim, "id" | "type" | "statement" | "state" | "section" | "citations">): Claim {
  return {
    handover_id: "h_1",
    confidence_reason: "",
    workstream: "general",
    entity_key: "general",
    owner: null,
    label: "contributor",
    review_status: "pending",
    sensitive: false,
    date: null,
    conflict_id: null,
    version: 1,
    confirmed_by: null,
    confirmed_at: null,
    ...p,
  };
}

export const claims: Claim[] = [
  // 1. Project in five lines
  cl({ id: "cl_p1", type: "fact", section: "project", state: "verified", statement: "CampusKart is a campus marketplace where students buy and sell second-hand items.", workstream: "product", entity_key: "product", date: "2026-07-20", confidence_reason: "Quote matches README.md; support check: supports", citations: [{ evidence_id: "ev_readme", quote: "CampusKart is a campus marketplace where students buy and sell second-hand items.", support: "full" }] }),
  cl({ id: "cl_p2", type: "fact", section: "project", state: "confirmed", statement: "Payments are taken through UPI deep links (no card gateway).", workstream: "payments", entity_key: "payments", date: "2026-08-14", confidence_reason: "Confirmed by reviewer after check against PR #87", review_status: "approved", confirmed_by: "reviewer", confirmed_at: "2026-11-08T12:10:00Z", version: 3, citations: [{ evidence_id: "ev_pr87", quote: "Move payments from the card gateway to UPI deep links", support: "full" }] }),

  // 2. Current state by workstream
  cl({ id: "cl_s1", type: "fact", section: "state", state: "conflicting", statement: "The README says the app is deployed on Render.", workstream: "deployment", entity_key: "deploy_target", date: "2026-07-20", conflict_id: "cf_1", confidence_reason: "Stated in README, but later commits configure Vercel. Both sides shown; neither is assumed correct.", citations: [{ evidence_id: "ev_readme", quote: "the app is deployed on Render (see render.yaml)", support: "full" }] }),
  cl({ id: "cl_s2", type: "fact", section: "state", state: "conflicting", statement: "Commits since 2 Oct configure the frontend deploy on Vercel.", workstream: "deployment", entity_key: "deploy_target", date: "2026-10-02", conflict_id: "cf_1", confidence_reason: "Stated in commit 9f3c2ab; contradicts README.", citations: [{ evidence_id: "ev_vercel", quote: "add vercel.json and configure the Vercel project for the frontend deploy", support: "full" }] }),
  cl({ id: "cl_s3", type: "fact", section: "state", state: "verified", statement: "The seller dashboard (PR #94) is open and not merged.", workstream: "seller-dashboard", entity_key: "pr_94", owner: "rohan", date: "2026-10-18", confidence_reason: "Quote matches PR #94; support check: supports", citations: [{ evidence_id: "ev_pr94", quote: "PR #94: Add seller dashboard.", support: "full" }] }),

  // 3. Decision log
  cl({ id: "cl_d1", type: "decision", section: "decision_log", state: "verified", statement: "Payments moved from a card gateway to UPI deep links in August, because the gateway needs merchant KYC the club cannot obtain.", workstream: "payments", entity_key: "payments", owner: "aditi", date: "2026-08-14", confidence_reason: "Quotes match PR #87 and the #payments chat; support check: supports", citations: [{ evidence_id: "ev_pr87", quote: "The card gateway needs merchant KYC, which we cannot get as a student club.", support: "full" }, { evidence_id: "ev_chat_upi", quote: "UPI hi chalega abhi. KYC ke chakkar mein nahi padna.", support: "full" }, { evidence_id: "ev_chat_kyc", quote: "gateway wale ne KYC maanga hai", support: "partial" }] }),
  cl({ id: "cl_d2", type: "decision", section: "decision_log", state: "confirmed", statement: "Image uploads were moved to a third-party storage bucket in late August.", workstream: "uploads", entity_key: "image_bucket", owner: "meera", date: "2026-08-25", confidence_reason: "Confirmed by reviewer", review_status: "edited", confirmed_by: "reviewer", confirmed_at: "2026-11-08T12:20:00Z", version: 3, citations: [{ evidence_id: "ev_chat_bucket", quote: "image uploads ab third-party bucket pe ja rahe hain", support: "full" }] }),

  // 4. First week
  cl({ id: "cl_f1", type: "next_action", section: "first_week", state: "verified", statement: "Review and unblock PR #94 (seller dashboard): changes were requested on 19 Oct and nothing has happened for about three weeks.", workstream: "seller-dashboard", entity_key: "pr_94", owner: "rohan", date: "2026-10-19", confidence_reason: "Quote matches PR #94; support check: supports", citations: [{ evidence_id: "ev_pr94", quote: "Changes requested by aditi on 2026-10-19. No activity since.", support: "full" }] }),
  cl({ id: "cl_f2", type: "next_action", section: "first_week", state: "inferred", statement: "AI inference — not stated in any source: replace the temporary login-loop fix with a proper fix in auth/session.ts.", workstream: "auth", entity_key: "auth_session", date: "2026-10-09", confidence_reason: "Inferred from the TODO in auth/session.ts; no source says who will do this or when.", citations: [{ evidence_id: "ev_todo", quote: "TODO: remove this hack once refresh token rotation is implemented", support: "partial" }] }),
  cl({ id: "cl_f3", type: "next_action", section: "first_week", state: "inferred", statement: "AI inference — not stated in any source: ask Meera to hand over the image bucket credential before the handover date.", workstream: "uploads", entity_key: "image_bucket", owner: "meera", date: "2026-08-25", confidence_reason: "Only Meera holds the credential (stated), so a handover step is implied but nobody wrote it down.", citations: [{ evidence_id: "ev_chat_bucket", quote: "Bucket ka credential sirf mere paas hai", support: "partial" }] }),

  // 5. Risks and landmines
  cl({ id: "cl_r1", type: "risk", section: "risks", state: "inferred", statement: "AI inference — not stated in any source: the login-loop fix in PR #91 is a workaround and may break again; auth/session.ts carries a TODO to remove it.", workstream: "auth", entity_key: "auth_session", date: "2026-10-09", confidence_reason: "PR title says 'temporary fix'; fragility is our inference.", citations: [{ evidence_id: "ev_pr91", quote: "temporary fix for login loop", support: "partial" }, { evidence_id: "ev_todo", quote: "TODO: remove this hack", support: "partial" }] }),
  cl({ id: "cl_r2", type: "risk", section: "risks", state: "verified", statement: "The build fails on Windows paths. It was raised three times (5 Sep, 19 Sep, 14 Oct) and has not been fixed.", workstream: "tooling", entity_key: "windows_build", date: "2026-10-14", confidence_reason: "Three quotes match chat messages; support check: supports", citations: [{ evidence_id: "ev_win1", quote: "build fails on Windows path again", support: "full" }, { evidence_id: "ev_win2", quote: "build fails on Windows path", support: "full" }, { evidence_id: "ev_win3", quote: "third time now — build fails on Windows path. Still no fix.", support: "full" }] }),
  cl({ id: "cl_r3", type: "risk", section: "risks", state: "verified", label: "lead_only", sensitive: true, statement: "Mentor feedback: Dev often misses deadlines and needs closer supervision.", workstream: "team", entity_key: "team_dev", date: "2026-10-30", confidence_reason: "Quote matches the lead-only mentor note", citations: [{ evidence_id: "ev_mentor1", quote: "Dev often misses deadlines and needs closer supervision.", support: "full" }] }),
  cl({ id: "cl_r4", type: "fact", section: "risks", state: "verified", label: "lead_only", sensitive: true, review_status: "redacted", statement: "A test API key and a personal phone number appear in the mentor note (both redacted).", workstream: "security", entity_key: "mentor_note_secrets", date: "2026-10-30", confidence_reason: "Detected by the secret/PII scan at ingestion", citations: [{ evidence_id: "ev_mentor1", quote: "Test key", support: "partial" }] }),

  // 6. Dependencies and people
  cl({ id: "cl_dep1", type: "dependency", section: "dependencies", state: "verified", statement: "Image uploads depend on a third-party storage bucket. Meera holds the only credential.", workstream: "uploads", entity_key: "image_bucket", owner: "meera", date: "2026-08-25", confidence_reason: "Quote matches the #dev chat; support check: supports", citations: [{ evidence_id: "ev_chat_bucket", quote: "Bucket ka credential sirf mere paas hai", support: "full" }] }),
  cl({ id: "cl_dep2", type: "dependency", section: "dependencies", state: "verified", statement: "Sign-up verification emails are sent through the college SMTP account.", workstream: "auth", entity_key: "smtp", date: "2026-09-10", confidence_reason: "Quotes match notes and chat; support check: supports", citations: [{ evidence_id: "ev_notes_smtp", quote: "verification emails are sent through the college SMTP account", support: "full" }, { evidence_id: "ev_chat_smtp", quote: "verification emails college SMTP account se ja rahe hain", support: "full" }] }),

  // 7. Still unresolved
  cl({ id: "cl_u1", type: "open_question", section: "unresolved", state: "verified", statement: "Whether to keep cash-on-delivery (COD) is undecided. The 20 Oct thread ended with \"no decision yet\".", workstream: "payments", entity_key: "cod", date: "2026-10-20", confidence_reason: "Both messages quoted; thread has no resolution", citations: [{ evidence_id: "ev_cod1", quote: "COD rakhein ya nahi?", support: "full" }, { evidence_id: "ev_cod2", quote: "no decision yet", support: "full" }] }),
  cl({ id: "cl_u2", type: "gap", section: "unresolved", state: "missing", statement: "Missing: nobody is named as the owner of the college SMTP account.", workstream: "auth", entity_key: "smtp", confidence_reason: "Two mentions found; neither names an owner", citations: [{ evidence_id: "ev_chat_smtp", quote: "pata nahi kisne setup kiya tha", support: "partial" }, { evidence_id: "ev_notes_smtp", quote: "college SMTP account (smtp.example.edu)", support: "partial" }] }),
  cl({ id: "cl_u3", type: "gap", section: "unresolved", state: "missing", statement: "Missing: nobody is named as the owner of the Vercel / Render accounts.", workstream: "deployment", entity_key: "deploy_accounts", confidence_reason: "Deploy config exists in two places; no source says who owns the accounts", citations: [{ evidence_id: "ev_vercel", quote: "configure the Vercel project", support: "partial" }, { evidence_id: "ev_readme", quote: "deployed on Render", support: "partial" }] }),
];

export const conflicts: Conflict[] = [
  { id: "cf_1", claim_ids: ["cl_s1", "cl_s2"], summary: "README says the app deploys on Render; commits since 2 Oct configure Vercel.", resolution: "open", resolved_by: null, note: null },
];

export const gaps: Gap[] = [
  { id: "gp_1", claim_id: "cl_u2", question: "Who owns the college SMTP account used for verification emails? We found two mentions but no owner.", evidence_found: ["ev_chat_smtp", "ev_notes_smtp"], status: "open", answer: null, answer_evidence_id: null },
  { id: "gp_2", claim_id: "cl_u3", question: "Who owns the Vercel and Render accounts, and which one is the real deploy target today?", evidence_found: ["ev_readme", "ev_vercel"], status: "open", answer: null, answer_evidence_id: null },
];

export const versions: VersionEntry[] = [
  { version: 1, at: "2026-11-08T11:00:00Z", actor: "system", summary: "Initial reconstruction: 19 claims extracted from 5 sources; 2 conflicting, 2 missing." },
  { version: 2, at: "2026-11-08T11:40:00Z", actor: "aditi", summary: "Leaver reviewed the Gap Interview list (0 of 2 answered)." },
  { version: 3, at: "2026-11-08T12:20:00Z", actor: "reviewer", summary: "Reviewer confirmed 2 claims and redacted the mentor-note secrets." },
];

// Newest first. Mirrors what the seeded claims already show (confirmed_by, redacted status).
export const audit: AuditEntry[] = [
  { at: "2026-11-08T12:20:00Z", actor: "reviewer", action: "redact", summary: "redact: A test API key and a personal phone number appear in the mentor note (both redacted).", claim_id: "cl_r4" },
  { at: "2026-11-08T12:20:00Z", actor: "reviewer", action: "edit", summary: "edit: Image uploads were moved to a third-party storage bucket in late August.", claim_id: "cl_d2" },
  { at: "2026-11-08T12:10:00Z", actor: "reviewer", action: "approve", summary: "approve: Payments are taken through UPI deep links (no card gateway).", claim_id: "cl_p2" },
  { at: "2026-11-08T11:00:00Z", actor: "system", action: "reconstruct", summary: "Initial reconstruction: 19 claims extracted from 5 sources; 2 conflicting, 2 missing.", claim_id: null },
  { at: "2026-11-08T10:55:00Z", actor: "reviewer", action: "create", summary: "Handover created.", claim_id: null },
];

// Claims as they stood at each seeded version (for the version diff). v3 is the seed above; v1 and v2
// are the same claims before the reviewer's actions logged at v3 (confirm cl_p2, edit cl_d2, redact cl_r4).
function before(c: Claim): Claim {
  if (c.id === "cl_p2") return { ...c, state: "verified", review_status: "pending", confirmed_by: null, confirmed_at: null, version: 1, confidence_reason: "Quote matches PR #87; support check: supports" };
  if (c.id === "cl_d2") return { ...c, state: "verified", review_status: "pending", statement: "Image uploads now go to a third-party bucket.", confirmed_by: null, confirmed_at: null, version: 1, confidence_reason: "Quote matches the #dev chat; support check: supports" };
  if (c.id === "cl_r4") return { ...c, review_status: "pending", version: 1 };
  return { ...c, version: 1 };
}
export const snapshots: Record<number, Claim[]> = {
  1: claims.map(before),
  2: claims.map(before),
  3: claims,
};
