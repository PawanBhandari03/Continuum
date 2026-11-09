// In-browser mock of the Continuum API, seeded with the synthetic CampusKart handover.
// State persists in localStorage so a judge can click through the whole workflow and reload.
// It enforces the SAME permission rule as the real system: a claim is visible only if the
// viewer's role may read ALL of its cited evidence, and sensitive claims are lead-only.
import type { Api, ClaimFilters } from "./api";
import type {
  AccessLabel,
  AckStatus,
  Claim,
  Conflict,
  EvidenceDetail,
  Gap,
  Handover,
  JobStatus,
  Readiness,
  Role,
  SectionKey,
  Source,
  VersionEntry,
  ViewSection,
} from "./types";
import * as seed from "@/mocks/campuskart";
import { beginWaking } from "./status";

interface HandoverBundle {
  handover: Handover;
  sources: Source[];
  claims: Claim[];
  conflicts: Conflict[];
  gaps: Gap[];
  versions: VersionEntry[];
  acks: Partial<Record<SectionKey, { status: AckStatus; note?: string }>>;
}

interface Store {
  bundles: Record<string, HandoverBundle>;
  evidence: typeof seed.evidence;
  jobs: Record<string, { hid: string; started: number }>;
  counter: number;
}

const KEY = "continuum-mock-v2";
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
// Failure simulation for demos/tests: localStorage "continuum-mock-fail" = "down" (every call fails after a short
// "waking" phase) or "slow" (calls succeed after a short "waking" phase). Unset in normal use.
function failMode(): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem("continuum-mock-fail") : null;
  } catch {
    return null;
  }
}
const delay = async <T,>(v: T, ms = 120): Promise<T> => {
  const mode = failMode();
  if (mode === "down" || mode === "slow") {
    const end = beginWaking();
    await new Promise((r) => setTimeout(r, mode === "slow" ? 2500 : 1200));
    end();
    if (mode === "down") throw new Error("Could not reach the server. It may be waking up; please retry in a minute. (simulated)");
    return v;
  }
  return new Promise<T>((r) => setTimeout(() => r(v), ms));
};

function seedStore(): Store {
  const h = clone(seed.handover);
  return {
    bundles: {
      [h.id]: {
        handover: h,
        sources: clone(seed.sources),
        claims: clone(seed.claims),
        conflicts: clone(seed.conflicts),
        gaps: clone(seed.gaps),
        versions: clone(seed.versions),
        acks: {},
      },
    },
    evidence: clone(seed.evidence),
    jobs: {},
    counter: 100,
  };
}

let mem: Store | null = null;
function store(): Store {
  if (mem) return mem;
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    if (raw) {
      mem = JSON.parse(raw);
      return mem!;
    }
  } catch {}
  mem = seedStore();
  return mem;
}
function save() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(mem));
  } catch {}
}
function bundle(hid: string): HandoverBundle {
  const b = store().bundles[hid];
  if (!b) throw new Error(`Handover ${hid} not found`);
  return b;
}
function bundleOfClaim(cid: string): { b: HandoverBundle; c: Claim } {
  for (const b of Object.values(store().bundles)) {
    const c = b.claims.find((x) => x.id === cid);
    if (c) return { b, c };
  }
  throw new Error(`Claim ${cid} not found`);
}
const nid = (p: string) => `${p}_${++store().counter}`;
const now = () => new Date().toISOString();

const RANK: Record<AccessLabel, number> = { public: 0, contributor: 1, lead_only: 2 };
const ROLE_MAX: Record<Role, number> = { lead: 2, contributor: 1, leaver: 1 };
const canRead = (role: Role, label: AccessLabel) => RANK[label] <= ROLE_MAX[role];

function bump(b: HandoverBundle, actor: string, summary: string) {
  b.handover.version += 1;
  b.versions.push({ version: b.handover.version, at: now(), actor, summary });
}

function computeReadiness(b: HandoverBundle): Readiness {
  const live = b.claims.filter((c) => c.review_status !== "rejected");
  const total = live.length;
  const filled = live.filter((c) => c.state === "verified" || c.state === "confirmed").length;
  const oc = b.conflicts.filter((c) => c.resolution === "open").length;
  const og = b.gaps.filter((g) => g.status === "open").length;
  const raw = total ? Math.round((filled / total) * 100) - 5 * oc - 3 * og : 0;
  return {
    score: Math.max(0, Math.min(100, raw)),
    formula: "slots_filled(verified+confirmed) / total_slots × 100 − 5 × open_conflicts − 3 × open_gaps",
    slots_filled: filled,
    slots_total: total,
    open_conflicts: oc,
    open_gaps: og,
  };
}

const SECTION_TITLES: [SectionKey, string][] = [
  ["project", "Project in five lines"],
  ["state", "Current state by workstream"],
  ["decision_log", "Decision log"],
  ["first_week", "Your first week"],
  ["risks", "Risks and landmines"],
  ["dependencies", "Dependencies and people"],
  ["unresolved", "Still unresolved"],
];

function claimVisible(c: Claim, role: Role, evidence: Store["evidence"]): boolean {
  if (c.review_status === "rejected" || c.review_status === "redacted") return false;
  if (role !== "lead" && c.sensitive) return false;
  if (!canRead(role, c.label)) return false;
  // most-restrictive-evidence rule: every cited unit must be readable
  return c.citations.every((ci) => {
    const u = evidence.find((e) => e.id === ci.evidence_id);
    return u ? canRead(role, u.label) : false;
  });
}

function addEvidenceUnit(text: string, author: string, hid: string): string {
  const s = store();
  const b = bundle(hid);
  let src = b.sources.find((x) => x.type === "exit_qa");
  if (!src) {
    src = { id: nid("src"), type: "exit_qa", name: "Exit Q&A (leaver answers)", status: "ok", status_reason: null, default_label: "contributor", unit_count: 0 };
    b.sources.push(src);
  }
  src.unit_count += 1;
  const id = nid("ev");
  s.evidence.push({ id, source_id: src.id, author, timestamp: now(), text, locator: `exit-qa://${id}`, label: "contributor", redactions: [] });
  return id;
}

export const mockApi: Api = {
  async listHandovers() {
    return delay(Object.values(store().bundles).map((b) => clone(b.handover)));
  },
  async getHandover(id) {
    return delay(clone(bundle(id).handover));
  },
  async createHandover(body) {
    const s = store();
    const id = nid("h");
    const h: Handover = { id, ...body, status: "draft", version: 1, approved_by: null, published_at: null };
    s.bundles[id] = { handover: h, sources: [], claims: [], conflicts: [], gaps: [], versions: [{ version: 1, at: now(), actor: "reviewer", summary: "Handover created." }], acks: {} };
    save();
    return delay(clone(h));
  },
  async getSources(hid) {
    return delay(clone(bundle(hid).sources));
  },
  async addSource(hid, body) {
    const b = bundle(hid);
    if (body.sample) {
      const have = new Set(b.sources.map((x) => x.id));
      for (const s of clone(seed.sources)) if (!have.has(s.id)) b.sources.push(s);
    } else {
      b.sources.push({
        id: nid("src"),
        type: body.type,
        name: body.name,
        status: body.type === "github" && !/github\.com\/[^/]+\/[^/]+/.test(body.ref ?? "") ? "failed" : "ok",
        status_reason: body.type === "github" && !/github\.com\/[^/]+\/[^/]+/.test(body.ref ?? "") ? "Could not parse a GitHub repo URL (expected https://github.com/owner/repo)." : null,
        default_label: "contributor",
        unit_count: 0,
      });
    }
    save();
    return delay(clone(b.sources));
  },
  async reconstruct(hid) {
    const s = store();
    const b = bundle(hid);
    const job_id = nid("job");
    s.jobs[job_id] = { hid, started: Date.now() };
    if (b.handover.id !== seed.handover.id && b.claims.length === 0) {
      // new handover: reconstruct produces the CampusKart claim set under this handover
      b.claims = clone(seed.claims).map((c) => ({ ...c, handover_id: hid }));
      b.conflicts = clone(seed.conflicts);
      b.gaps = clone(seed.gaps);
      b.handover.status = "in_review";
      b.versions.push({ version: b.handover.version, at: now(), actor: "system", summary: `Initial reconstruction: ${b.claims.length} claims extracted.` });
    }
    save();
    return delay({ job_id });
  },
  async getJob(jobId) {
    const j = store().jobs[jobId];
    if (!j) throw new Error("Job not found");
    const t = (Date.now() - j.started) / 1000;
    const stages: JobStatus["stage"][] = ["parse", "protect", "extract", "verify", "conflicts_gaps"];
    const per = 1.4;
    if (t >= per * stages.length) return { status: "done", stage: null, progress: 100, error: null };
    const idx = Math.floor(t / per);
    return { status: "running", stage: stages[idx], progress: Math.round((t / (per * stages.length)) * 100), error: null };
  },
  async getClaims(hid, f?: ClaimFilters) {
    const out = bundle(hid).claims.filter(
      (c) =>
        (!f?.state || c.state === f.state) &&
        (!f?.type || c.type === f.type) &&
        (!f?.workstream || c.workstream === f.workstream) &&
        (!f?.review_status || c.review_status === f.review_status),
    );
    return delay(clone(out));
  },
  async patchClaim(id, body, actor) {
    const { b, c } = bundleOfClaim(id);
    switch (body.action) {
      case "approve":
        c.review_status = "approved";
        // state stays honest: an approved inference is still labelled Inferred
        c.confirmed_by = actor;
        c.confirmed_at = now();
        break;
      case "edit":
        if (!body.edited_statement?.trim()) throw new Error("Edited statement cannot be empty");
        c.statement = body.edited_statement.trim();
        c.review_status = "edited";
        c.state = c.state === "inferred" ? "inferred" : "confirmed";
        c.confirmed_by = actor;
        c.confirmed_at = now();
        break;
      case "reject":
        c.review_status = "rejected";
        break;
      case "redact":
        c.review_status = "redacted";
        c.sensitive = true;
        break;
      case "mark_sensitive":
        c.sensitive = !c.sensitive;
        break;
      default:
        throw new Error(`Unsupported action ${body.action}`);
    }
    c.version += 1;
    bump(b, actor, `${body.action.replace("_", " ")}: ${c.id}${body.note ? ` — ${body.note}` : ""}`);
    save();
    return delay(clone(c));
  },
  async bulkApproveVerified(hid, actor) {
    const b = bundle(hid);
    const targets = b.claims.filter((c) => c.state === "verified" && c.review_status === "pending" && !c.sensitive);
    targets.forEach((c) => {
      c.review_status = "approved";
      c.confirmed_by = actor;
      c.confirmed_at = now();
    });
    if (targets.length) bump(b, actor, `Approved ${targets.length} verified claims`);
    save();
    return delay(targets.length);
  },
  async getEvidence(claimId, role) {
    const { b, c } = bundleOfClaim(claimId);
    if (!claimVisible(c, role, store().evidence) && role !== "lead") throw new Error("Not permitted: you cannot see this claim's evidence.");
    const ev = store().evidence;
    const out: EvidenceDetail[] = [];
    for (const ci of c.citations) {
      const unit = ev.find((e) => e.id === ci.evidence_id);
      if (!unit || !canRead(role, unit.label)) continue;
      const source = b.sources.find((s) => s.id === unit.source_id) ?? seed.sources.find((s) => s.id === unit.source_id)!;
      const sameSrc = ev.filter((e) => e.source_id === unit.source_id && canRead(role, e.label)).sort((a, z) => a.timestamp.localeCompare(z.timestamp));
      const i = sameSrc.findIndex((e) => e.id === unit.id);
      const context = sameSrc.slice(Math.max(0, i - 2), i + 3);
      out.push(clone({ citation: ci, unit, source, context }));
    }
    return delay(out);
  },
  async getConflicts(hid) {
    return delay(clone(bundle(hid).conflicts));
  },
  async resolveConflict(id, body, actor) {
    for (const b of Object.values(store().bundles)) {
      const cf = b.conflicts.find((x) => x.id === id);
      if (!cf) continue;
      if (body.resolution === "open") throw new Error("Choose resolved or unresolved_followup");
      if (body.resolution === "resolved" && !body.note.trim()) throw new Error("A resolution note is required (who decided, why).");
      cf.resolution = body.resolution;
      cf.resolved_by = actor;
      cf.note = body.note;
      const sides = b.claims.filter((c) => cf.claim_ids.includes(c.id));
      for (const c of sides) {
        if (body.resolution === "resolved") {
          if (body.keep_claim_id && c.id !== body.keep_claim_id) {
            c.review_status = "rejected";
          } else if (body.keep_claim_id) {
            c.state = "confirmed";
            c.confirmed_by = actor;
            c.confirmed_at = now();
            c.review_status = "approved";
            c.conflict_id = null;
          }
        }
        // unresolved_followup: both claims stay "conflicting" and go to the successor as an open item
      }
      bump(b, actor, `Conflict ${cf.id} → ${body.resolution === "resolved" ? "resolved" : "marked unresolved (successor to follow up)"}`);
      save();
      return delay(clone(cf));
    }
    throw new Error("Conflict not found");
  },
  async getGaps(hid) {
    return delay(clone(bundle(hid).gaps));
  },
  async answerGap(id, body, actor) {
    for (const b of Object.values(store().bundles)) {
      const g = b.gaps.find((x) => x.id === id);
      if (!g) continue;
      if (!body.answer.trim()) throw new Error("Answer cannot be empty (use Skip instead).");
      const evId = addEvidenceUnit(body.answer.trim(), actor, b.handover.id);
      g.status = "answered";
      g.answer = body.answer.trim();
      g.answer_evidence_id = evId;
      const c = b.claims.find((x) => x.id === g.claim_id);
      if (c) {
        c.statement = `${c.statement.replace(/^Missing: /, "Answered by leaver: ")} — "${g.answer}"`;
        c.state = "confirmed";
        c.type = c.type === "gap" ? "fact" : c.type;
        c.citations = [...c.citations, { evidence_id: evId, quote: g.answer.slice(0, 120), support: "full" }];
        c.confidence_reason = "Leaver's Exit Q&A answer (pending reviewer approval)";
        c.confirmed_by = actor;
        c.confirmed_at = now();
        c.review_status = "pending";
      }
      bump(b, actor, `Gap ${g.id} answered by leaver (new Exit Q&A evidence ${evId})`);
      save();
      return delay(clone(g));
    }
    throw new Error("Gap not found");
  },
  async skipGap(id) {
    for (const b of Object.values(store().bundles)) {
      const g = b.gaps.find((x) => x.id === id);
      if (!g) continue;
      g.status = "skipped";
      save();
      return delay(clone(g));
    }
    throw new Error("Gap not found");
  },
  async getReadiness(hid) {
    return delay(computeReadiness(bundle(hid)));
  },
  async getVersions(hid) {
    return delay(clone(bundle(hid).versions).reverse());
  },
  async publish(hid, actor) {
    const b = bundle(hid);
    const reasons: string[] = [];
    const open = b.conflicts.filter((c) => c.resolution === "open").length;
    if (open) reasons.push(`${open} conflict${open > 1 ? "s are" : " is"} unresolved. Resolve ${open > 1 ? "them" : "it"} or mark "unresolved — successor to follow up".`);
    const pending = b.claims.filter((c) => c.review_status === "pending").length;
    if (pending) reasons.push(`${pending} claim${pending > 1 ? "s have" : " has"} not been reviewed yet.`);
    if (reasons.length) return delay({ ok: false, reasons });
    b.handover.status = "published";
    b.handover.approved_by = actor;
    b.handover.published_at = now();
    bump(b, actor, "Published and locked this version.");
    save();
    return delay({ ok: true, reasons: [] });
  },
  async getView(hid, role) {
    const b = bundle(hid);
    const ev = store().evidence;
    let hidden = 0;
    const sections: ViewSection[] = SECTION_TITLES.map(([key, title]) => {
      const inSection = b.claims.filter((c) => c.section === key && c.review_status !== "rejected" && c.review_status !== "redacted");
      const visible = inSection.filter((c) => claimVisible(c, role, ev));
      hidden += inSection.length - visible.length;
      // also count redacted claims that exist (content never revealed)
      return { key, title, claims: clone(visible), ack: b.acks[key]?.status ?? "none" };
    });
    hidden += b.claims.filter((c) => c.review_status === "redacted" && role !== "lead").length;
    return delay({ handover: clone(b.handover), sections, hidden_count: role === "lead" ? 0 : hidden });
  },
  async ack(hid, body, actor) {
    const b = bundle(hid);
    b.acks[body.section as SectionKey] = { status: body.status, note: body.note };
    // acknowledgements are logged but do not create a new handover version
    b.versions.push({ version: b.handover.version, at: now(), actor, summary: `${body.status === "acknowledged" ? "Acknowledged" : "Flagged unclear"}: ${body.section}${body.note ? ` — ${body.note}` : ""}` });
    save();
    return delay(undefined);
  },
  async resetDemo() {
    mem = seedStore();
    save();
  },
};
