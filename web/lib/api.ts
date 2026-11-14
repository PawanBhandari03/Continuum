// API client for the Continuum FastAPI backend (contracts: docs/contracts.md, shapes: ./types.ts).
// Local development: run `python api/dev.py` (in-memory API with the CampusKart demo, no keys needed) and the
// web app talks to http://localhost:8000 by default. Production sets NEXT_PUBLIC_API_URL.
import type {
  AccessLabel,
  AckStatus,
  AiStatus,
  AuditEntry,
  Claim,
  ClaimType,
  Conflict,
  ConflictAction,
  ConflictEvent,
  EvidenceDetail,
  EvidenceState,
  Gap,
  Handover,
  JobStatus,
  NotificationItem,
  PrivacyItem,
  Readiness,
  ReviewActionKind,
  ReviewStatus,
  Role,
  SectionKey,
  Source,
  SourceType,
  SuccessorView,
  Task,
  TaskStatus,
  VersionDiff,
  VersionsInfo,
} from "./types";
import { beginWaking } from "./status";
import { accessToken } from "./auth";

/** Kept for older imports: the in-browser mock was retired in Round 3 (the in-memory API replaces it). */
export const USE_MOCKS = false;
const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export interface ClaimFilters {
  state?: EvidenceState;
  type?: ClaimType;
  workstream?: string;
  review_status?: ReviewStatus;
}

export interface NewHandover {
  leaver: string;
  successor: string;
  successor_role: "contributor" | "lead";
  target_date: string;
}

export interface NewSource {
  type: SourceType;
  name: string;
  /** GitHub repo URL. Tokens are never stored client-side. */
  ref?: string;
  /** use the bundled CampusKart sample sources */
  sample?: boolean;
}

export interface ResolveBody {
  action: ConflictAction;
  note: string;
  keep_claim_ids?: string[];
  scope_note?: string;
  corrected_statement?: string;
}

export type GapWithEvidence = Gap & { evidence?: { id: string; author: string; ts: string; locator: string; source_name: string | null; text: string }[] };

export interface Api {
  listHandovers(include?: string | null): Promise<Handover[]>;
  getHandover(id: string): Promise<Handover>;
  createHandover(body: NewHandover): Promise<Handover>;
  createSandbox(): Promise<{ handover_id: string }>;
  getSources(hid: string): Promise<Source[]>;
  addSource(hid: string, body: NewSource): Promise<Source[]>;
  /** Upload a Slack export (.zip) or notes (.md/.txt/.pdf). Bad files come back as a visible failed/partial source, not an exception. */
  uploadSource(hid: string, body: { type: "chat_export" | "notes"; file: File; label: AccessLabel }): Promise<Source>;
  reconstruct(hid: string): Promise<{ job_id: string }>;
  getJob(jobId: string): Promise<JobStatus>;
  getAiStatus(): Promise<AiStatus>;
  getClaims(hid: string, filters?: ClaimFilters): Promise<Claim[]>;
  patchClaim(id: string, body: { action: ReviewActionKind; edited_statement?: string; note?: string }, actor?: string): Promise<Claim>;
  bulkApproveVerified(hid: string, actor?: string): Promise<number>;
  /** Approve every claim still pending. Returns how many. */
  bulkApproveRemaining(hid: string, actor?: string): Promise<number>;
  getEvidence(claimId: string, role: Role): Promise<EvidenceDetail[]>;
  getConflicts(hid: string): Promise<Conflict[]>;
  resolveConflict(id: string, body: ResolveBody, actor?: string): Promise<Conflict>;
  getConflictHistory(id: string): Promise<ConflictEvent[]>;
  getGaps(hid: string, withEvidence?: boolean): Promise<GapWithEvidence[]>;
  answerGap(id: string, body: { answer: string }, actor?: string): Promise<Gap>;
  skipGap(id: string): Promise<Gap>;
  getReadiness(hid: string): Promise<Readiness>;
  getVersions(hid: string): Promise<VersionsInfo>;
  getAudit(hid: string): Promise<AuditEntry[]>;
  verifyAudit(hid: string): Promise<{ ok: boolean; entries: number; broken_at: number | null; head?: string }>;
  auditCsvUrl(hid: string): string;
  getVersionDiff(hid: string, from: number, to: number): Promise<VersionDiff>;
  publish(hid: string, actor?: string): Promise<{ ok: boolean; reasons: string[]; version?: number; sha256?: string }>;
  getView(hid: string, role: Role, opts?: { version?: number; draft?: boolean; as?: Role }): Promise<SuccessorView>;
  ack(hid: string, body: { section: string; status: AckStatus; note?: string }, actor?: string): Promise<{ ok: boolean; version: number; task: Task | null }>;
  getTasks(hid: string, status?: TaskStatus): Promise<Task[]>;
  createTask(hid: string, body: { kind: "unclear_flag" | "successor_question"; section?: SectionKey | null; claim_id?: string | null; text: string }): Promise<Task>;
  answerTask(id: string, answer: string): Promise<Task>;
  resolveTask(id: string, body: { action: "attach" | "new_claim" | "resolve" | "wont_fix"; claim_id?: string; statement?: string; note?: string }): Promise<Task>;
  getNotifications(hid: string): Promise<{ version: number; status: Handover["status"]; items: NotificationItem[] }>;
  getPrivacy(hid: string, status?: string): Promise<{ items: PrivacyItem[]; counts: Record<string, number> }>;
  decidePrivacy(id: string, body: { decision: "keep_masked" | "unmask" | "escalate_lead_only" | "dismiss"; reason?: string }): Promise<PrivacyItem>;
  logExport(hid: string, format: string, version?: number, bodySha256?: string): Promise<{ version: number; sha256: string | null; exported_at: string; signature: string | null }>;
  verifyExport(text: string): Promise<{ ok: boolean; reason: string; handover?: string; version?: number; published_at?: string }>;
  resetDemo(hid?: string): Promise<void>;
  getMe(): Promise<{ id: string; email: string; handovers: (Handover & { my_role: Role })[] }>;
  getMyRole(hid: string): Promise<{ private: boolean; role: Role; signed_in: boolean; email: string | null }>;
  listMembers(hid: string): Promise<{ email: string; role: Role; invited_by: string | null; created_at: string; joined: boolean }[]>;
  addMember(hid: string, email: string, role: Role): Promise<{ email: string; role: Role; invited_by: string | null; created_at: string; joined: boolean }[]>;
}

// ---------- real backend (thin fetch wrapper; shapes are the contracts in types.ts) ----------
// At most MAX_INFLIGHT requests at once (the free-tier API is small), with retries on network errors and
// 502/503/504 so a sleeping Render instance (about a minute to wake) does not surface as an error.
const MAX_INFLIGHT = 6;
let inflight = 0;
const waiting: Array<() => void> = [];
async function slot<T>(fn: () => Promise<T>, priority = false): Promise<T> {
  // user actions (writes) go to the front of the queue so they are never stuck behind background reads
  if (inflight >= MAX_INFLIGHT) await new Promise<void>((r) => (priority ? waiting.unshift(r) : waiting.push(r)));
  inflight++;
  try {
    return await fn();
  } finally {
    inflight--;
    waiting.shift()?.();
  }
}
async function limitedFetch(url: string, init: RequestInit, timeoutMs = 30000): Promise<Response> {
  const priority = (init.method ?? "GET").toUpperCase() !== "GET";
  return slot(async () => {
    let last: unknown;
    let endWaking: (() => void) | null = null;
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          // per-attempt timeout so a hung connection to a sleeping server cannot block the screen forever
          const r = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
          if (![502, 503, 504].includes(r.status)) return r;
          last = new Error(`Server not ready (HTTP ${r.status})`);
        } catch (e) {
          last = e;
        }
        endWaking ??= beginWaking(); // tells the UI to show the "Waking the server" banner
        await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt > 20000 ? 20000 : 2000 * 2 ** attempt));
      }
      throw new Error(`Could not reach the server. It may be waking up; please retry in a minute. (${(last as Error)?.message ?? "network error"})`);
    } finally {
      endWaking?.(); // banner clears on success and on final failure
    }
  }, priority);
}

// The role is read from storage the moment this module loads (in the browser), not later in a React effect.
// Pages start their first API calls in their own effects, which run BEFORE the session provider's effect; without
// this, a refresh or a pasted link would call the API as the default role and show "not permitted".
const ROLES: Role[] = ["lead", "contributor", "leaver", "guest"];
let currentRole: Role | null = (() => {
  try {
    if (typeof window === "undefined") return null;
    const r = window.localStorage.getItem("continuum-role") as Role | null;
    return r && ROLES.includes(r) ? r : null;
  } catch {
    return null;
  }
})();
/** Called by the session provider so every API call carries the viewer's role. */
export function setApiRole(r: Role | null) {
  currentRole = r;
}

async function detailOf(res: Response): Promise<string> {
  let detail: unknown = res.statusText;
  try {
    detail = (await res.json()).detail ?? detail;
  } catch {}
  return typeof detail === "string" ? detail : JSON.stringify(detail);
}

async function http<T>(path: string, init?: RequestInit & { role?: Role }, timeoutMs?: number): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const role = init?.role ?? currentRole;
  if (role) headers["X-Demo-Role"] = role; // demo roles (ignored by the API for private handovers: membership decides)
  const token = await accessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await limitedFetch(`${API_URL}${path}`, { ...init, headers: { ...headers, ...(init?.headers as Record<string, string>) } }, timeoutMs);
  if (!res.ok) throw new Error(await detailOf(res));
  return (res.status === 204 ? undefined : await res.json()) as T;
}
const post = (b: unknown) => ({ method: "POST", body: JSON.stringify(b) });
const q = (f?: ClaimFilters) => {
  const p = new URLSearchParams();
  Object.entries(f ?? {}).forEach(([k, v]) => v && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

const realApi: Api = {
  listHandovers: (include) => http(`/handovers${include ? `?include=${encodeURIComponent(include)}` : ""}`),
  getHandover: (id) => http(`/handovers/${id}`),
  createHandover: (b) => http("/handovers", post(b)),
  createSandbox: () => http("/demo/sandbox", { method: "POST", body: "{}" }, 120000),
  getSources: (h) => http(`/handovers/${h}/sources`),
  addSource: async (h, b) => {
    await http(`/handovers/${h}/sources`, post(b), 180000);
    return http(`/handovers/${h}/sources`);
  },
  uploadSource: async (h, b) => {
    const fd = new FormData();
    fd.append("type", b.type);
    fd.append("label", b.label);
    fd.append("file", b.file);
    const headers: Record<string, string> = {};
    if (currentRole) headers["X-Demo-Role"] = currentRole; // no Content-Type: the browser sets the multipart boundary
    const token = await accessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await limitedFetch(`${API_URL}/handovers/${h}/sources/upload`, { method: "POST", body: fd, headers }, 120000);
    if (!res.ok) throw new Error(await detailOf(res));
    return (await res.json()) as Source;
  },
  reconstruct: (h) => http(`/handovers/${h}/reconstruct`, post({})),
  getJob: (id) => http(`/jobs/${id}`),
  getAiStatus: () => http("/ai/status"),
  getClaims: (h, f) => http(`/handovers/${h}/claims${q(f)}`),
  patchClaim: (id, b) => http(`/claims/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  bulkApproveVerified: async (h) =>
    (await http<{ approved: number }>(`/handovers/${h}/claims/bulk`, post({ action: "approve", state: "verified" }))).approved,
  bulkApproveRemaining: async (h) =>
    (await http<{ approved: number }>(`/handovers/${h}/claims/bulk`, post({ action: "approve" }))).approved,
  getEvidence: (id, role) => http(`/claims/${id}/evidence`, { role }),
  getConflicts: (h) => http(`/handovers/${h}/conflicts`),
  resolveConflict: (id, b) => http(`/conflicts/${id}/resolve`, post(b)),
  getConflictHistory: (id) => http(`/conflicts/${id}/history`),
  getGaps: (h, withEvidence) => http(`/handovers/${h}/gaps${withEvidence ? "?with_evidence=1" : ""}`),
  answerGap: (id, b) => http(`/gaps/${id}/answer`, post(b)),
  skipGap: (id) => http(`/gaps/${id}/answer`, post({ answer: "", skip: true })),
  getReadiness: (h) => http(`/handovers/${h}/readiness`),
  getVersions: (h) => http(`/handovers/${h}/versions`),
  getAudit: (h) => http(`/handovers/${h}/audit`),
  verifyAudit: (h) => http(`/handovers/${h}/audit/verify`),
  auditCsvUrl: (h) => `${API_URL}/handovers/${h}/audit.csv`,
  getVersionDiff: (h, a, b) => http(`/handovers/${h}/versions/${a}/diff/${b}`),
  publish: async (h) => {
    try {
      const r = await http<{ ok: boolean; version: number; sha256: string }>(`/handovers/${h}/publish`, post({}));
      return { ...r, reasons: [] };
    } catch (e) {
      return { ok: false, reasons: [(e as Error).message] };
    }
  },
  getView: (h, role, o) => {
    const p = new URLSearchParams();
    if (o?.version) p.set("version", String(o.version));
    if (o?.draft) p.set("draft", "1");
    if (o?.as) p.set("as", o.as);
    const s = p.toString();
    return http(`/handovers/${h}/view${s ? `?${s}` : ""}`, { role: o?.as || o?.draft ? "lead" : role });
  },
  ack: (h, b) => http(`/handovers/${h}/ack`, post(b)),
  getTasks: (h, status) => http(`/handovers/${h}/tasks${status ? `?status=${status}` : ""}`),
  createTask: (h, b) => http(`/handovers/${h}/tasks`, post(b)),
  answerTask: (id, answer) => http(`/tasks/${id}/answer`, post({ answer })),
  resolveTask: (id, b) => http(`/tasks/${id}/resolve`, post({ note: "", ...b })),
  getNotifications: (h) => http(`/handovers/${h}/notifications`),
  getPrivacy: (h, status) => http(`/handovers/${h}/redactions${status ? `?status=${status}` : ""}`),
  decidePrivacy: (id, b) => http(`/redactions/${id}/decide`, post({ reason: "", ...b })),
  logExport: (h, format, version, bodySha256) => http(`/handovers/${h}/exports`, post({ format, version, body_sha256: bodySha256 })),
  verifyExport: (text) => http("/exports/verify", post({ text })),
  getMe: () => http("/me"),
  getMyRole: (h) => http(`/handovers/${h}/me`),
  listMembers: (h) => http(`/handovers/${h}/members`),
  addMember: (h, email, role) => http(`/handovers/${h}/members`, post({ email, role })),
  resetDemo: async (hid = "h_1") => {
    await http(`/handovers/${hid}/reset`, { method: "POST", role: "lead", body: "{}" }, 180000);
  },
};

export const api: Api = realApi;
