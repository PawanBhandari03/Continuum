// API client facade. Same function surface for the mock store and the real FastAPI backend.
// NEXT_PUBLIC_USE_MOCKS=true (default) => in-browser mock store seeded with CampusKart.
// Flip to false and set NEXT_PUBLIC_API_URL when Pawan's API is live.
import type {
  AckStatus,
  Claim,
  ClaimType,
  Conflict,
  ConflictResolution,
  EvidenceDetail,
  EvidenceState,
  Gap,
  Handover,
  JobStatus,
  PublishResult,
  Readiness,
  ReviewActionKind,
  ReviewStatus,
  Role,
  Source,
  SourceType,
  SuccessorView,
  VersionEntry,
} from "./types";
import { mockApi } from "./mock-api";

export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

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
  /** GitHub repo URL, or a file name for uploads. Tokens are never stored client-side. */
  ref?: string;
  /** use the bundled CampusKart sample sources */
  sample?: boolean;
}

export interface Api {
  listHandovers(): Promise<Handover[]>;
  getHandover(id: string): Promise<Handover>;
  createHandover(body: NewHandover): Promise<Handover>;
  getSources(hid: string): Promise<Source[]>;
  addSource(hid: string, body: NewSource): Promise<Source[]>;
  reconstruct(hid: string): Promise<{ job_id: string }>;
  getJob(jobId: string): Promise<JobStatus>;
  getClaims(hid: string, filters?: ClaimFilters): Promise<Claim[]>;
  patchClaim(
    id: string,
    body: { action: ReviewActionKind; edited_statement?: string; note?: string },
    actor: string,
  ): Promise<Claim>;
  bulkApproveVerified(hid: string, actor: string): Promise<number>;
  getEvidence(claimId: string, role: Role): Promise<EvidenceDetail[]>;
  getConflicts(hid: string): Promise<Conflict[]>;
  resolveConflict(id: string, body: { resolution: ConflictResolution; note: string; keep_claim_id?: string }, actor: string): Promise<Conflict>;
  getGaps(hid: string): Promise<Gap[]>;
  answerGap(id: string, body: { answer: string }, actor: string): Promise<Gap>;
  skipGap(id: string): Promise<Gap>;
  getReadiness(hid: string): Promise<Readiness>;
  getVersions(hid: string): Promise<VersionEntry[]>;
  publish(hid: string, actor: string): Promise<PublishResult>;
  getView(hid: string, role: Role): Promise<SuccessorView>;
  ack(hid: string, body: { section: string; status: AckStatus; note?: string }, actor: string): Promise<void>;
  resetDemo(): Promise<void>;
}

// ---------- real backend (thin fetch wrapper; shapes are the contracts in types.ts) ----------
let currentRole: Role | null = null;
/** Called by the session provider so every API call carries the viewer's role. */
export function setApiRole(r: Role | null) {
  currentRole = r;
}

async function http<T>(path: string, init?: RequestInit & { role?: Role }): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const role = init?.role ?? currentRole;
  if (role) headers["X-Demo-Role"] = role; // replaced by Supabase JWT once auth is wired
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: { ...headers, ...(init?.headers as Record<string, string>) } });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {}
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
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
  listHandovers: () => http("/handovers"),
  getHandover: (id) => http(`/handovers/${id}`),
  createHandover: (b) => http("/handovers", post(b)),
  getSources: (h) => http(`/handovers/${h}/sources`),
  addSource: async (h, b) => {
    await http(`/handovers/${h}/sources`, post(b));
    return http(`/handovers/${h}/sources`);
  },
  reconstruct: (h) => http(`/handovers/${h}/reconstruct`, post({})),
  getJob: (id) => http(`/jobs/${id}`),
  getClaims: (h, f) => http(`/handovers/${h}/claims${q(f)}`),
  patchClaim: (id, b) => http(`/claims/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  bulkApproveVerified: async (h) => {
    const claims = await http<Claim[]>(`/handovers/${h}/claims?state=verified&review_status=pending`);
    for (const c of claims) await http(`/claims/${c.id}`, { method: "PATCH", body: JSON.stringify({ action: "approve" }) });
    return claims.length;
  },
  getEvidence: (id, role) => http(`/claims/${id}/evidence`, { role }),
  getConflicts: (h) => http(`/handovers/${h}/conflicts`),
  resolveConflict: (id, b) => http(`/conflicts/${id}/resolve`, post(b)),
  getGaps: (h) => http(`/handovers/${h}/gaps`),
  answerGap: (id, b) => http(`/gaps/${id}/answer`, post(b)),
  skipGap: (id) => http(`/gaps/${id}/answer`, post({ answer: "", skip: true })),
  getReadiness: (h) => http(`/handovers/${h}/readiness`),
  getVersions: (h) => http(`/handovers/${h}/versions`),
  publish: async (h) => {
    try {
      await http(`/handovers/${h}/publish`, post({}));
      return { ok: true, reasons: [] };
    } catch (e) {
      return { ok: false, reasons: [(e as Error).message] };
    }
  },
  getView: (h, role) => http(`/handovers/${h}/view`, { role }),
  ack: (h, b) => http(`/handovers/${h}/ack`, post(b)),
  resetDemo: async () => {
    await http("/handovers/h_1/reset", { method: "POST", role: "lead", body: "{}" });
  },
};

export const api: Api = USE_MOCKS ? mockApi : realApi;
