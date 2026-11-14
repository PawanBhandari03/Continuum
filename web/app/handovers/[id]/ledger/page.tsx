"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, EyeOff, History, Lock, Pencil, ShieldAlert, X } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Claim, ClaimType, EvidenceState, Handover, Readiness, ReviewStatus, SectionKey, VersionsInfo } from "@/lib/types";
import { Button, Card, Notice, PageTitle, fmtDateTime } from "@/components/ui";
import { HandoverNav, RoleGuard, notifyChanged } from "@/components/shell";
import { AttentionTiles } from "@/components/attention";
import { ClaimCard } from "@/components/claim-card";
import { ExportButtons } from "@/components/export";
import { VersionCompare } from "@/components/version-diff";
import { ModalShell } from "@/components/modal";
import { invalidateEvidence } from "@/components/evidence";
import { EmptyState, LoadError, SkeletonList } from "@/components/feedback";
import { friendlyError } from "@/lib/status";

const SECTIONS: [SectionKey, string][] = [
  ["project", "1. Project in five lines"], ["state", "2. Current state by workstream"], ["decision_log", "3. Decision log"], ["first_week", "4. Your first week"],
  ["risks", "5. Risks and landmines"], ["dependencies", "6. Dependencies and people"], ["unresolved", "7. Still unresolved"],
];

export default function LedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { actor } = useSession();
  const [h, setH] = useState<Handover | null>(null);
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [ready, setReady] = useState<Readiness | null>(null);
  const [versions, setVersions] = useState<VersionsInfo | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [showFormula, setShowFormula] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [f, setF] = useState<{ state: "" | EvidenceState; type: "" | ClaimType; review: "" | ReviewStatus; ws: string }>({ state: "", type: "", review: "", ws: "" });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const [hh, cc, rr, vv] = await Promise.all([api.getHandover(id), api.getClaims(id), api.getReadiness(id), api.getVersions(id)]);
      setH(hh); setClaims(cc); setReady(rr); setVersions(vv);
    } catch (e) { setLoadErr(friendlyError(e)); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // status "published" = the latest version has no unpublished changes; editing is always possible and starts the next draft
  const published = h?.status === "published";
  const latest = versions?.published[0] ?? null;
  const open = (claims ?? []).filter(Boolean);
  const pending = open.filter((c) => c.review_status === "pending").length;
  const conflictsOpen = ready?.open_conflicts ?? 0;
  const reasons = useMemo(() => {
    const r: string[] = [];
    if (conflictsOpen) r.push(`${conflictsOpen} conflict${conflictsOpen > 1 ? "s" : ""} unresolved — resolve or mark "unresolved — successor to follow up".`);
    if (pending) r.push(`${pending} claim${pending > 1 ? "s" : ""} not reviewed yet.`);
    return r;
  }, [conflictsOpen, pending]);

  const workstreams = useMemo(() => [...new Set(open.map((c) => c.workstream))].sort(), [open]);
  const shown = open.filter((c) => (!f.state || c.state === f.state) && (!f.type || c.type === f.type) && (!f.review || c.review_status === f.review) && (!f.ws || c.workstream === f.ws));

  async function act(c: Claim, action: Parameters<typeof api.patchClaim>[1]["action"], extra: { edited_statement?: string } = {}) {
    setErr(null); setMsg(null);
    try { await api.patchClaim(c.id, { action, ...extra }, actor); invalidateEvidence(); notifyChanged(); await load(); }
    catch (e) { setErr(friendlyError(e)); }
  }
  async function publish() {
    setErr(null); setMsg(null);
    const r = await api.publish(id, actor);
    if (!r.ok) setBlocked(r.reasons); else { setBlocked([]); setMsg(`Published v${r.version}. That version is now frozen (SHA-256 ${r.sha256?.slice(0, 12)}…) and is what the successor reads. Further edits start the next draft.`); notifyChanged(); }
    await load();
  }
  async function bulk() {
    const n = await api.bulkApproveVerified(id, actor);
    setMsg(`Approved ${n} verified claim${n === 1 ? "" : "s"}. Inferred, conflicting and missing claims still need an individual decision.`);
    await load();
  }

  async function approveRest() {
    try {
      const n = await api.bulkApproveRemaining(id, actor);
      invalidateEvidence();
      setMsg(`Approved ${n} remaining claim${n === 1 ? "" : "s"}. Inferred, conflicting and missing claims keep their labels; approval does not change an evidence state.`);
      await load();
    } catch (e) { setErr(friendlyError(e)); }
  }

  const sel = "rounded-md border border-slate-300 bg-white px-2 py-1 text-sm";
  const emptyState = claims && claims.length === 0;

  return (
    <RoleGuard hid={id} allow={["lead"]}>
      <HandoverNav hid={id} />
      <AttentionTiles hid={id} />
      <PageTitle
        title="Claim ledger"
        sub="Every statement below is a claim with an evidence state and clickable sources. Nothing reaches the successor until you approve it and publish."
        right={<div className="flex flex-wrap items-start gap-2"><Button onClick={() => setShowVersions(true)}><History size={14} aria-hidden /> Versions (published v{h?.version ?? "…"})</Button>{claims && claims.length > 0 && <ExportButtons hid={id} />}</div>}
      />
      {loadErr && <div className="mb-3"><LoadError message={loadErr} onRetry={load} /></div>}
      {!claims && !loadErr && <SkeletonList rows={4} label="Loading claims" />}
      {err && <div className="mb-3"><Notice tone="error">{err}</Notice></div>}
      {msg && <div className="mb-3"><Notice>{msg}</Notice></div>}

      {emptyState && <EmptyState title="No claims yet" hint={<><Link className="underline" href={`/handovers/${id}/connect`}>Connect sources</Link> and run Reconstruct first.</>} />}

      {ready && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Handover readiness</div>
              <div className="flex items-baseline gap-1"><span className="text-3xl font-bold">{ready.score}</span><span className="text-slate-500">/ 100</span></div>
              <button className="mt-0.5 inline-flex items-center gap-1 text-xs text-indigo-700 hover:underline" onClick={() => setShowFormula(!showFormula)} aria-expanded={showFormula}>
                How is this calculated? {showFormula ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>
            <dl className="grid grid-cols-3 gap-6 text-sm">
              <div><dt className="text-slate-500">Slots filled</dt><dd className="font-semibold">{ready.slots_filled} / {ready.slots_total}</dd></div>
              <div><dt className="text-slate-500">Open conflicts</dt><dd className="font-semibold">{ready.open_conflicts} {ready.open_conflicts > 0 && <Link className="tap text-xs font-normal text-indigo-700 underline" href={`/handovers/${id}/conflicts`}>resolve</Link>}</dd></div>
              <div><dt className="text-slate-500">Open gaps</dt><dd className="font-semibold">{ready.open_gaps} {ready.open_gaps > 0 && <Link className="tap text-xs font-normal text-indigo-700 underline" href={`/handovers/${id}/interview`}>interview</Link>}</dd></div>
            </dl>
            <div className="ml-auto flex flex-col items-end gap-1">
              {latest && (
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900" title={`SHA-256 ${latest.sha256}`}>
                  <Lock size={13} aria-hidden /> Successor reads v{latest.version} · signed {latest.sha256.slice(0, 10)}…
                </span>
              )}
              {published ? (
                <span className="text-xs text-slate-600">No changes since v{h?.version}. Any edit starts draft v{(h?.version ?? 0) + 1}.</span>
              ) : (
                <>
                  <Button variant="primary" disabled={reasons.length > 0} onClick={publish}>Publish v{(h?.version ?? 0) + 1}</Button>
                  <Button variant="ghost" onClick={bulk} className="text-xs">Approve all Verified claims</Button>
                  <Button variant="ghost" onClick={approveRest} disabled={pending === 0} className="text-xs">Approve all remaining ({pending})</Button>
                </>
              )}
            </div>
          </div>
          {showFormula && <p className="mt-3 rounded bg-slate-50 p-2 text-xs text-slate-700"><code>{ready.formula}</code>. It measures how much of the handover is backed by evidence or a human, not whether the content is correct.</p>}
          {!published && reasons.length > 0 && (
            <ul className="mt-3 list-disc pl-5 text-sm text-amber-900" aria-label="Why publishing is blocked">
              {reasons.map((r) => <li key={r}>Publish blocked: {r}</li>)}
            </ul>
          )}
          {blocked.length > 0 && <div className="mt-2"><Notice tone="error">Publish refused: {blocked.join(" ")}</Notice></div>}
        </Card>
      )}

      {claims && claims.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Filters">
            <span className="text-slate-600">Filter:</span>
            <select aria-label="Evidence state" className={sel} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value as never })}>
              <option value="">All states</option>{["verified", "inferred", "conflicting", "missing", "confirmed"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select aria-label="Claim type" className={sel} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as never })}>
              <option value="">All types</option>{["decision", "risk", "dependency", "owner", "next_action", "open_question", "fact", "gap"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
            <select aria-label="Workstream" className={sel} value={f.ws} onChange={(e) => setF({ ...f, ws: e.target.value })}>
              <option value="">All workstreams</option>{workstreams.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select aria-label="Review status" className={sel} value={f.review} onChange={(e) => setF({ ...f, review: e.target.value as never })}>
              <option value="">Any review status</option>{["pending", "approved", "edited", "rejected", "redacted"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {(f.state || f.type || f.review || f.ws) && <button className="text-indigo-700 underline" onClick={() => setF({ state: "", type: "", review: "", ws: "" })}>Clear</button>}
            <span className="ml-auto text-slate-500">{shown.length} of {open.length} claims</span>
          </div>

          <div className="space-y-6">
            {SECTIONS.map(([key, title]) => {
              const all = shown.filter((c) => c.section === key);
              if (!all.length) return null;
              // needs attention first: conflicting, missing, inferred, then confirmed, then verified (stable within a group)
              const rank: Record<string, number> = { conflicting: 0, missing: 1, inferred: 2, confirmed: 3, verified: 4 };
              const sorted = all.map((c, i) => ({ c, i })).sort((a, b) => (rank[a.c.state] ?? 9) - (rank[b.c.state] ?? 9) || a.i - b.i).map((x) => x.c);
              const LIMIT = 8;
              const open = !!expandedSections[key];
              const items = open ? sorted : sorted.slice(0, LIMIT);
              return (
                <section key={key} aria-labelledby={`sec-${key}`}>
                  <h2 id={`sec-${key}`} className="mb-2 text-lg font-semibold">{title}</h2>
                  <div className="space-y-2.5">
                    {items.map((c) => (
                      <ClaimCard key={c.id} claim={c} showReview
                        actions={c.review_status === "superseded" ? undefined : (
                          <>
                            <Button variant="secondary" onClick={() => act(c, "approve")} disabled={c.review_status === "approved"}><Check size={14} aria-hidden /> Approve</Button>
                            <Button onClick={() => setEditing({ id: c.id, text: c.statement })}><Pencil size={14} aria-hidden /> Edit</Button>
                            <Button variant="danger" onClick={() => act(c, "reject")} disabled={c.review_status === "rejected"}><X size={14} aria-hidden /> Reject</Button>
                            <Button onClick={() => act(c, "mark_sensitive")}><ShieldAlert size={14} aria-hidden /> {c.sensitive ? "Unmark sensitive" : "Mark sensitive"}</Button>
                            <Button onClick={() => act(c, "redact")} disabled={c.review_status === "redacted"}><EyeOff size={14} aria-hidden /> Redact</Button>
                          </>
                        )}
                        footer={c.conflict_id && <p className="mt-2 text-xs text-rose-800">Part of a conflict. <Link className="tap underline" href={`/handovers/${id}/conflicts`}>Open side-by-side resolution</Link></p>}
                      />
                    ))}
                  </div>
                  {sorted.length > LIMIT && (
                    <button className="mt-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-indigo-800 hover:bg-indigo-50" aria-expanded={open} onClick={() => setExpandedSections({ ...expandedSections, [key]: !open })}>
                      {open ? `Show fewer (first ${LIMIT})` : `Show all ${sorted.length} claims in this section (${sorted.length - LIMIT} more)`}
                    </button>
                  )}
                </section>
              );
            })}
            {shown.length === 0 && <p className="text-sm text-slate-600">No claims match these filters.</p>}
          </div>
        </>
      )}

      {editing && (
        <ModalShell label="Edit claim" onClose={() => setEditing(null)} align="center" panelClassName="w-full max-w-lg rounded-lg bg-white p-4 shadow-xl">
          <div>
            <h2 className="font-semibold">Edit claim</h2>
            <p className="mt-1 text-xs text-slate-600">Your edit is recorded with your name and the time. The original citations stay attached so reviewers can check the new wording against the sources.</p>
            <textarea className="mt-3 h-32 w-full rounded-md border border-slate-300 p-2 text-sm" value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} aria-label="Claim statement" />
            <div className="mt-3 flex justify-end gap-2">
              <Button onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="primary" disabled={!editing.text.trim()} onClick={async () => { const c = claims!.find((x) => x.id === editing.id)!; const t = editing.text; setEditing(null); await act(c, "edit", { edited_statement: t }); }}>Save edit</Button>
            </div>
          </div>
        </ModalShell>
      )}

      {showVersions && (
        <ModalShell label="Version history" onClose={() => setShowVersions(false)} panelClassName="h-full w-full max-w-xl overflow-y-auto bg-white p-4 shadow-xl">
          <div>
            <div className="flex items-center justify-between"><h2 className="font-semibold">Version history</h2><button aria-label="Close" onClick={() => setShowVersions(false)} className="rounded p-2.5 hover:bg-slate-100 sm:p-1"><X size={18} /></button></div>
            {!versions && <div className="mt-4"><SkeletonList rows={2} label="Loading versions" /></div>}
            {versions && (
              <>
                <h3 className="mt-4 text-sm font-semibold">Published versions</h3>
                {versions.published.length === 0 && <EmptyState title="Nothing published yet" />}
                <ul className="mt-2 space-y-2">
                  {versions.published.map((v) => (
                    <li key={v.version} className="rounded border border-slate-200 p-2 text-sm">
                      <b>v{v.version}</b> · {fmtDateTime(v.published_at)} · {v.published_by}
                      <div className="break-all font-mono text-[11px] text-slate-500">SHA-256 {v.sha256}</div>
                    </li>
                  ))}
                </ul>
                <div className="mt-4"><VersionCompare hid={id} published={versions.published} /></div>
              </>
            )}
            <h3 className="mt-5 text-sm font-semibold">Draft changes since the beginning (newest first)</h3>
            <ol className="mt-2 space-y-3 border-l-2 border-slate-200 pl-4">
              {versions?.draft?.log.map((v, i) => (
                <li key={i}><div className="text-xs text-slate-500">rev {v.revision ?? "–"} · {fmtDateTime(v.at)} · <b>{v.actor}</b></div><div className="text-sm">{v.summary}</div></li>
              ))}
            </ol>
          </div>
        </ModalShell>
      )}
    </RoleGuard>
  );
}
