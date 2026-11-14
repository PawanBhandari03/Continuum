"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { Download, ShieldCheck, ShieldX } from "lucide-react";
import { api } from "@/lib/api";
import { friendlyError } from "@/lib/status";
import type { AuditEntry, Claim } from "@/lib/types";
import { Button, Notice, PageTitle, fmtDateTime } from "@/components/ui";
import { HandoverNav, RoleGuard } from "@/components/shell";
import { EmptyState, LoadError, SkeletonList } from "@/components/feedback";

type Group = "review" | "conflict" | "publish" | "handover" | "system" | "view" | "privacy";
const ACTIONS: Record<string, { label: string; group: Group }> = {
  approve: { label: "Approved", group: "review" },
  edit: { label: "Edited", group: "review" },
  reject: { label: "Rejected", group: "review" },
  redact: { label: "Redacted", group: "review" },
  mark_sensitive: { label: "Marked sensitive", group: "review" },
  resolve_conflict: { label: "Conflict decision", group: "conflict" },
  reopen_conflict: { label: "Conflict reopened", group: "conflict" },
  answer_gap: { label: "Gap answered (leaver)", group: "conflict" },
  skip_gap: { label: "Gap skipped (leaver)", group: "conflict" },
  ask_question: { label: "Question asked (successor)", group: "handover" },
  answer_task: { label: "Question answered (leaver)", group: "handover" },
  resolve_task: { label: "Question used by reviewer", group: "review" },
  privacy_decision: { label: "Privacy decision", group: "privacy" },
  view_handover: { label: "Viewed the handover", group: "view" },
  view_evidence: { label: "Opened sources", group: "view" },
  export: { label: "Exported", group: "view" },
  connect: { label: "Source connected", group: "system" },
  publish: { label: "Published", group: "publish" },
  ack: { label: "Acknowledged (successor)", group: "handover" },
  flag_unclear: { label: "Flagged unclear (successor)", group: "handover" },
  create: { label: "Created", group: "system" },
  upload: { label: "Source uploaded", group: "system" },
  reconstruct: { label: "Reconstructed", group: "system" },
  reset: { label: "Demo reset", group: "system" },
};
const GROUP_CLS: Record<Group, string> = {
  review: "border-indigo-300 bg-indigo-50 text-indigo-900",
  conflict: "border-rose-300 bg-rose-50 text-rose-900",
  publish: "border-emerald-300 bg-emerald-50 text-emerald-900",
  handover: "border-amber-300 bg-amber-50 text-amber-900",
  system: "border-slate-300 bg-slate-50 text-slate-800",
  view: "border-sky-300 bg-sky-50 text-sky-900",
  privacy: "border-teal-300 bg-teal-50 text-teal-900",
};
const CATS: { key: string; label: string; test: (a: string) => boolean }[] = [
  { key: "views", label: "Views", test: (a) => a === "view_handover" || a === "view_evidence" },
  { key: "exports", label: "Exports", test: (a) => a === "export" },
  { key: "decisions", label: "Decisions", test: (a) => ["approve", "edit", "reject", "redact", "mark_sensitive", "resolve_conflict", "reopen_conflict", "privacy_decision", "resolve_task", "publish"].includes(a) },
];
const meta = (a: string) => ACTIONS[a] ?? { label: a.replace(/_/g, " "), group: "system" as Group };

export default function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [cat, setCat] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [check, setCheck] = useState<{ ok: boolean; entries: number; broken_at: number | null; head?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  async function verify() {
    setChecking(true);
    try {
      setCheck(await api.verifyAudit(id));
    } catch (e) {
      setLoadErr(friendlyError(e));
    } finally {
      setChecking(false);
    }
  }

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const [a, c] = await Promise.all([api.getAudit(id), api.getClaims(id).catch(() => [] as Claim[])]);
      setRows(a);
      setClaims(c);
    } catch (e) {
      setLoadErr(friendlyError(e));
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const actors = useMemo(() => [...new Set((rows ?? []).map((r) => r.actor))].sort(), [rows]);
  const actions = useMemo(() => [...new Set((rows ?? []).map((r) => r.action))].sort(), [rows]);
  const day = (r: AuditEntry) => r.at.slice(0, 10);
  const shown = (rows ?? []).filter(
    (r) =>
      (!action || r.action === action) &&
      (!actor || r.actor === actor) &&
      (!cat || CATS.find((c) => c.key === cat)?.test(r.action)) &&
      (!from || day(r) >= from) &&
      (!to || day(r) <= to),
  );
  const sel = "rounded-md border border-slate-300 bg-white px-2 py-1 text-sm";

  return (
    <RoleGuard hid={id} allow={["lead"]}>
      <HandoverNav hid={id} />
      <PageTitle
        title="Activity and audit log"
        sub="Who did what, and when: reviews, conflict and privacy decisions, the leaver's answers, publishing, every time someone opened the handover or its sources, and every export. Each entry carries a fingerprint of the one before it, so a changed or deleted entry is detectable."
        right={
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={verify} disabled={checking}><ShieldCheck size={14} aria-hidden /> {checking ? "Checking…" : "Verify integrity"}</Button>
            <a className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-50" href={api.auditCsvUrl(id)} download><Download size={14} aria-hidden /> CSV</a>
            <Button onClick={load}>Refresh</Button>
          </div>
        }
      />
      {check && (
        <div className="mb-4">
          {check.ok ? (
            <Notice><span className="inline-flex items-center gap-1.5"><ShieldCheck size={15} aria-hidden /> <b>Chain intact.</b> All {check.entries} entries match their fingerprints{check.head ? ` (latest ${check.head.slice(0, 12)}…)` : ""}. Nothing was edited or removed.</span></Notice>
          ) : (
            <Notice tone="error"><span className="inline-flex items-center gap-1.5"><ShieldX size={15} aria-hidden /> <b>Chain broken at entry #{check.broken_at}.</b> That entry or one before it was changed or removed after it was written.</span></Notice>
          )}
        </div>
      )}
      {loadErr && <LoadError message={loadErr} onRetry={load} />}
      {!rows && !loadErr && <SkeletonList rows={4} label="Loading activity" />}
      {rows?.length === 0 && <EmptyState title="No activity recorded yet" hint="Approve, edit or publish something in the claim ledger and it will appear here." />}
      {rows && rows.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Filters">
            <span className="text-slate-600">Filter:</span>
            <select aria-label="Action" className={sel} value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">All actions</option>
              {actions.map((a) => <option key={a} value={a}>{meta(a).label}</option>)}
            </select>
            <select aria-label="Person" className={sel} value={actor} onChange={(e) => setActor(e.target.value)}>
              <option value="">Everyone</option>
              {actors.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <span role="group" aria-label="Category" className="flex gap-1">
              {CATS.map((c) => (
                <button key={c.key} aria-pressed={cat === c.key} onClick={() => setCat(cat === c.key ? "" : c.key)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${cat === c.key ? "border-[#25272d] bg-[#25272d] text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"}`}>{c.label}</button>
              ))}
            </span>
            <label className="flex items-center gap-1 text-slate-600">From <input type="date" className={sel} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="flex items-center gap-1 text-slate-600">To <input type="date" className={sel} value={to} onChange={(e) => setTo(e.target.value)} /></label>
            {(action || actor || cat || from || to) && <button className="text-indigo-700 underline" onClick={() => { setAction(""); setActor(""); setCat(""); setFrom(""); setTo(""); }}>Clear</button>}
            <span className="ml-auto text-slate-600">{shown.length} of {rows.length} entries</span>
          </div>
          <ol className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white" aria-label="Activity log">
            {shown.map((r, i) => {
              const m = meta(r.action);
              const claim = r.claim_id ? claims.find((c) => c.id === r.claim_id) : null;
              return (
                <li key={`${r.at}-${i}`} className="grid gap-1 p-3 text-sm sm:grid-cols-[11rem_1fr]">
                  <div className="text-xs text-slate-600">
                    <time dateTime={r.at}>{fmtDateTime(r.at)}</time>
                    <div className="font-semibold capitalize text-slate-800">{r.actor}</div>
                  </div>
                  <div>
                    <span className={`mr-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${GROUP_CLS[m.group]}`}>{m.label}</span>
                    <span className="text-slate-900">{r.summary}</span>
                    {claim && <div className="mt-0.5 text-xs text-slate-600">Claim: “{claim.statement.slice(0, 110)}{claim.statement.length > 110 ? "…" : ""}”</div>}
                    {r.claim_id && !claim && <div className="mt-0.5 text-xs text-slate-600">Claim id: {r.claim_id}</div>}
                  </div>
                </li>
              );
            })}
          </ol>
          {shown.length === 0 && <p className="mt-3 text-sm text-slate-600">No entries match these filters.</p>}
        </>
      )}
    </RoleGuard>
  );
}
