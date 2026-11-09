"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, EyeOff, History, Lock, Pencil, ShieldAlert, X } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Claim, ClaimType, EvidenceState, Handover, Readiness, ReviewStatus, SectionKey, VersionEntry } from "@/lib/types";
import { Button, Card, Notice, PageTitle, fmtDateTime } from "@/components/ui";
import { HandoverNav, RoleGuard } from "@/components/shell";
import { ClaimCard } from "@/components/claim-card";
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
  const [versions, setVersions] = useState<VersionEntry[] | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [showFormula, setShowFormula] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [f, setF] = useState<{ state: "" | EvidenceState; type: "" | ClaimType; review: "" | ReviewStatus; ws: string }>({ state: "", type: "", review: "", ws: "" });
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const [hh, cc, rr, vv] = await Promise.all([api.getHandover(id), api.getClaims(id), api.getReadiness(id), api.getVersions(id)]);
      setH(hh); setClaims(cc); setReady(rr); setVersions(vv);
    } catch (e) { setLoadErr(friendlyError(e)); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const published = h?.status === "published";
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
    try { await api.patchClaim(c.id, { action, ...extra }, actor); invalidateEvidence(); await load(); }
    catch (e) { setErr(friendlyError(e)); }
  }
  async function publish() {
    setErr(null); setMsg(null);
    const r = await api.publish(id, actor);
    if (!r.ok) setBlocked(r.reasons); else { setBlocked([]); setMsg("Published. This version is now locked and visible to the successor."); }
    await load();
  }
  async function bulk() {
    const n = await api.bulkApproveVerified(id, actor);
    setMsg(`Approved ${n} verified claim${n === 1 ? "" : "s"}. Inferred, conflicting and missing claims still need an individual decision.`);
    await load();
  }

  async function approveRest() {
    const todo = (claims ?? []).filter((c) => c.review_status === "pending");
    try {
      for (const c of todo) await api.patchClaim(c.id, { action: "approve" }, actor);
      invalidateEvidence();
      setMsg(`Approved ${todo.length} remaining claim${todo.length === 1 ? "" : "s"}. Inferred, conflicting and missing claims keep their labels; approval does not change an evidence state.`);
      await load();
    } catch (e) { setErr(friendlyError(e)); }
  }

  const sel = "rounded-md border border-slate-300 bg-white px-2 py-1 text-sm";
  const emptyState = claims && claims.length === 0;

  return (
    <RoleGuard hid={id} allow={["lead"]}>
      <HandoverNav hid={id} />
      <PageTitle
        title="Claim ledger"
        sub="Every statement below is a claim with an evidence state and clickable sources. Nothing reaches the successor until you approve it and publish."
        right={<Button onClick={() => setShowVersions(true)}><History size={14} aria-hidden /> Version history (v{h?.version ?? "…"})</Button>}
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
              <div><dt className="text-slate-500">Open conflicts</dt><dd className="font-semibold">{ready.open_conflicts} {ready.open_conflicts > 0 && <Link className="text-xs font-normal text-indigo-700 underline" href={`/handovers/${id}/conflicts`}>resolve</Link>}</dd></div>
              <div><dt className="text-slate-500">Open gaps</dt><dd className="font-semibold">{ready.open_gaps} {ready.open_gaps > 0 && <Link className="text-xs font-normal text-indigo-700 underline" href={`/handovers/${id}/interview`}>interview</Link>}</dd></div>
            </dl>
            <div className="ml-auto flex flex-col items-end gap-1">
              {published ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900"><Lock size={14} aria-hidden /> Published v{h?.version} · locked</span>
              ) : (
                <>
                  <Button variant="primary" disabled={reasons.length > 0} onClick={publish}>Approve and publish</Button>
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
              const items = shown.filter((c) => c.section === key);
              if (!items.length) return null;
              return (
                <section key={key} aria-labelledby={`sec-${key}`}>
                  <h2 id={`sec-${key}`} className="mb-2 text-lg font-semibold">{title}</h2>
                  <div className="space-y-2.5">
                    {items.map((c) => (
                      <ClaimCard key={c.id} claim={c} showReview
                        actions={published ? undefined : (
                          <>
                            <Button variant="secondary" onClick={() => act(c, "approve")} disabled={c.review_status === "approved"}><Check size={14} aria-hidden /> Approve</Button>
                            <Button onClick={() => setEditing({ id: c.id, text: c.statement })}><Pencil size={14} aria-hidden /> Edit</Button>
                            <Button variant="danger" onClick={() => act(c, "reject")} disabled={c.review_status === "rejected"}><X size={14} aria-hidden /> Reject</Button>
                            <Button onClick={() => act(c, "mark_sensitive")}><ShieldAlert size={14} aria-hidden /> {c.sensitive ? "Unmark sensitive" : "Mark sensitive"}</Button>
                            <Button onClick={() => act(c, "redact")} disabled={c.review_status === "redacted"}><EyeOff size={14} aria-hidden /> Redact</Button>
                          </>
                        )}
                        footer={c.conflict_id && <p className="mt-2 text-xs text-rose-800">Part of a conflict. <Link className="underline" href={`/handovers/${id}/conflicts`}>Open side-by-side resolution</Link></p>}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
            {shown.length === 0 && <p className="text-sm text-slate-600">No claims match these filters.</p>}
          </div>
        </>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="Edit claim">
          <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow-xl">
            <h2 className="font-semibold">Edit claim</h2>
            <p className="mt-1 text-xs text-slate-600">Your edit is recorded with your name and the time. The original citations stay attached so reviewers can check the new wording against the sources.</p>
            <textarea className="mt-3 h-32 w-full rounded-md border border-slate-300 p-2 text-sm" value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} aria-label="Claim statement" />
            <div className="mt-3 flex justify-end gap-2">
              <Button onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="primary" disabled={!editing.text.trim()} onClick={async () => { const c = claims!.find((x) => x.id === editing.id)!; const t = editing.text; setEditing(null); await act(c, "edit", { edited_statement: t }); }}>Save edit</Button>
            </div>
          </div>
        </div>
      )}

      {showVersions && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Version history">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setShowVersions(false)} />
          <aside className="relative h-full w-full max-w-md overflow-y-auto bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between"><h2 className="font-semibold">Version history</h2><button aria-label="Close" onClick={() => setShowVersions(false)} className="rounded p-1 hover:bg-slate-100"><X size={18} /></button></div>
            {!versions && <div className="mt-4"><SkeletonList rows={2} label="Loading versions" /></div>}
            {versions?.length === 0 && <div className="mt-4"><EmptyState title="No versions yet" /></div>}
            <ol className="mt-4 space-y-3 border-l-2 border-slate-200 pl-4">
              {versions?.map((v, i) => (
                <li key={i}><div className="text-xs text-slate-500">v{v.version} · {fmtDateTime(v.at)} · <b>{v.actor}</b></div><div className="text-sm">{v.summary}</div></li>
              ))}
            </ol>
          </aside>
        </div>
      )}
    </RoleGuard>
  );
}
