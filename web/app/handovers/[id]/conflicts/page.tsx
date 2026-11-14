"use client";
import { use, useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock3, ExternalLink, History, RotateCcw } from "lucide-react";
import { api, type ResolveBody } from "@/lib/api";
import type { Conflict, ConflictAction, ConflictEvent } from "@/lib/types";
import { Button, Card, Notice, PageTitle, StateBadge, fmtDate, fmtDateTime, sourceIcon } from "@/components/ui";
import { HandoverNav, RoleGuard, notifyChanged } from "@/components/shell";
import { invalidateEvidence, useEvidenceDrawer } from "@/components/evidence";
import { EmptyState, LoadError, SkeletonList } from "@/components/feedback";
import { friendlyError } from "@/lib/status";

const KIND: Record<Conflict["kind"], { label: string; help: string }> = {
  staleness: { label: "Out of date", help: "A document says one thing, but newer activity (commits, chat) says another. Documents often go stale." },
  value: { label: "Different values", help: "Sources name different values for the same thing." },
  ownership: { label: "Different owners", help: "Sources name different people as the owner." },
};
const RESULT: Record<Conflict["resolution"], string> = {
  open: "Open", kept: "Settled: one side kept", both_true: "Settled: both true", corrected: "Settled: corrected", deferred: "Deferred to the successor",
};
const EVENT: Record<ConflictEvent["action"], string> = {
  detected: "Detected", kept: "Kept one side", both_true: "Marked both true", corrected: "Corrected", deferred: "Deferred", reopened: "Reopened",
};

export default function ConflictsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      setConflicts(await api.getConflicts(id));
    } catch (e) {
      setLoadErr(friendlyError(e));
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const open = conflicts?.filter((c) => c.resolution === "open" || c.resolution === "deferred") ?? [];
  const done = conflicts?.filter((c) => c.resolution !== "open" && c.resolution !== "deferred") ?? [];
  return (
    <RoleGuard hid={id} allow={["lead"]}>
      <HandoverNav hid={id} />
      <PageTitle
        title="Conflicts"
        sub="When sources disagree, Continuum shows every side with its source, author and date, and never picks a winner for you, not even the newest. You decide, with a reason, and the decision is kept in the history."
      />
      {loadErr && <LoadError message={loadErr} onRetry={load} />}
      {!conflicts && !loadErr && <SkeletonList rows={2} label="Loading conflicts" />}
      {conflicts?.length === 0 && <EmptyState title="No conflicts detected" hint="Nothing in the connected sources contradicts anything else." />}
      {conflicts && conflicts.length > 0 && (
        <p className="mb-4 text-sm text-slate-700" aria-live="polite">
          <b>{conflicts.filter((c) => c.resolution === "open").length}</b> open · <b>{conflicts.filter((c) => c.resolution === "deferred").length}</b> deferred · <b>{done.length}</b> settled
        </p>
      )}
      <div className="space-y-6">
        {[...open, ...done].map((cf) => <ConflictCard key={cf.id} cf={cf} onChanged={load} />)}
      </div>
    </RoleGuard>
  );
}

function ConflictCard({ cf, onChanged }: { cf: Conflict; onChanged: () => Promise<void> }) {
  const settled = cf.resolution !== "open" && cf.resolution !== "deferred";
  const sides = cf.sides ?? [];
  const [action, setAction] = useState<ConflictAction | null>(null);
  const [keep, setKeep] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [scope, setScope] = useState("");
  const [fixed, setFixed] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showHist, setShowHist] = useState(false);
  const [hist, setHist] = useState<ConflictEvent[] | null>(null);
  const { open: openEvidence } = useEvidenceDrawer();

  const dates = sides.map((s) => s.evidence.map((e) => e.ts).sort().at(-1) ?? s.claim.date ?? "");
  const min = Math.min(...dates.filter(Boolean).map((d) => +new Date(d)));
  const max = Math.max(...dates.filter(Boolean).map((d) => +new Date(d)));
  const newest = dates.indexOf(dates.filter(Boolean).sort().at(-1) ?? "");

  async function submit(a: ConflictAction) {
    setErr(null);
    setBusy(true);
    const body: ResolveBody = { action: a, note };
    if (a === "keep") body.keep_claim_ids = keep ? [keep] : [];
    if (a === "both_true") body.scope_note = scope;
    if (a === "correct") body.corrected_statement = fixed;
    try {
      await api.resolveConflict(cf.id, body);
      invalidateEvidence();
      notifyChanged();
      setAction(null);
      setNote("");
      await onChanged();
      if (showHist) setHist(await api.getConflictHistory(cf.id));
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  async function toggleHistory() {
    const next = !showHist;
    setShowHist(next);
    if (next) setHist(await api.getConflictHistory(cf.id).catch(() => []));
  }

  const noteOk = note.trim().length >= 10;
  const ready =
    action === "keep" ? !!keep && noteOk :
    action === "both_true" ? scope.trim().length > 0 && noteOk :
    action === "correct" ? fixed.trim().length > 0 && noteOk :
    action === "defer";
  const label = { keep: "Keep this side and settle", both_true: "Settle: both are true", correct: "Settle with the corrected version", defer: "Defer to the successor", reopen: "Reopen" }[action ?? "keep"];

  return (
    <Card className={settled ? "border-emerald-200" : cf.resolution === "deferred" ? "border-amber-300" : "border-rose-300"}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${settled ? "border-emerald-300 bg-emerald-50 text-emerald-900" : cf.resolution === "deferred" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-rose-300 bg-rose-50 text-rose-900"}`}>
          {settled ? <CheckCircle2 size={13} aria-hidden /> : <AlertTriangle size={13} aria-hidden />} {RESULT[cf.resolution]}
        </span>
        <span title={KIND[cf.kind].help} className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-800">{KIND[cf.kind].label}</span>
        {cf.entity_key && <span className="text-xs text-slate-500">Topic: <b className="capitalize">{cf.entity_key}</b></span>}
        <span className="text-xs text-slate-500">Found by {cf.detected_by.includes("rules") ? "named-value rules (no AI)" : "the AI contradiction check"}</span>
        {cf.severity === "blocking" && cf.resolution === "open" && <span className="ml-auto text-xs font-medium text-rose-800">Blocks publishing</span>}
      </div>
      <h2 className="mt-2 font-semibold text-slate-900">{cf.summary}</h2>
      {cf.kind === "staleness" && <p className="mt-1 text-sm text-slate-700"><Clock3 size={14} className="mr-1 inline" aria-hidden />{KIND.staleness.help} Continuum still does not assume the newer side is right.</p>}

      {sides.length > 1 && Number.isFinite(min) && max > min && (
        <div className="mt-3" aria-label="When each side was written">
          <div className="relative h-8 rounded bg-slate-100">
            {sides.map((s, i) => {
              const pos = dates[i] ? ((+new Date(dates[i]) - min) / (max - min)) * 100 : 0;
              return (
                <span key={s.claim.id} className="absolute top-1 -translate-x-1/2 whitespace-nowrap rounded-full border border-slate-400 bg-white px-1.5 text-[11px] font-semibold text-slate-800" style={{ left: `${Math.min(92, Math.max(8, pos))}%` }}>
                  {String.fromCharCode(65 + i)} · {fmtDate(dates[i])}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className={`mt-3 grid gap-3 ${sides.length > 2 ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>
        {sides.map((s, i) => {
          const kept = settled && cf.resolution === "kept" && s.claim.review_status !== "superseded";
          const lost = s.claim.review_status === "superseded";
          return (
            <div key={s.claim.id} className={`flex flex-col rounded-lg border p-3 ${keep === s.claim.id && action === "keep" ? "border-indigo-600 ring-2 ring-indigo-200" : kept ? "border-emerald-400 bg-emerald-50/40" : lost ? "border-slate-200 opacity-70" : "border-slate-200"}`}>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-slate-800 px-1.5 py-0.5 font-bold text-white">Side {String.fromCharCode(65 + i)}</span>
                <StateBadge state={s.claim.state} />
                {i === newest && sides.length > 1 && <span className="text-slate-500">newest</span>}
                {kept && <span className="font-semibold text-emerald-800">Kept</span>}
                {lost && <span className="font-semibold text-slate-600">Not kept</span>}
              </div>
              <p className="text-sm font-medium text-slate-900">{s.claim.statement}</p>
              <ul className="mt-2 space-y-2">
                {s.evidence.map((e) => {
                  const Icon = sourceIcon(e.source_type ?? "notes");
                  return (
                    <li key={e.evidence_id} className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5 text-slate-700">
                        <Icon size={13} aria-hidden /> <b>{e.source_name ?? e.source_type}</b> · {e.author} · <time dateTime={e.ts}>{fmtDate(e.ts)}</time>
                      </div>
                      <blockquote className="mt-1 border-l-2 border-slate-400 pl-2 text-slate-900">“{e.quote}”</blockquote>
                      <div className="mt-1 flex gap-3">
                        <button className="tap text-indigo-700 underline" onClick={() => openEvidence(s.claim, e.evidence_id)}>Read in context</button>
                        {/^https?:/.test(e.locator) && <a className="tap inline-flex items-center gap-0.5 text-indigo-700 underline" href={e.locator} target="_blank" rel="noreferrer">Open original <ExternalLink size={11} aria-hidden /></a>}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {!settled && (
                <label className="mt-auto flex min-h-10 cursor-pointer items-center gap-2 pt-3 text-sm font-medium">
                  <input type="radio" name={`keep-${cf.id}`} checked={action === "keep" && keep === s.claim.id} onChange={() => { setAction("keep"); setKeep(s.claim.id); }} />
                  Keep side {String.fromCharCode(65 + i)}
                </label>
              )}
            </div>
          );
        })}
      </div>

      {settled || cf.resolution === "deferred" ? (
        <p className="mt-3 text-sm text-slate-800">
          <b>{RESULT[cf.resolution]}</b> by {cf.resolved_by}{cf.decided_at ? ` on ${fmtDateTime(cf.decided_at)}` : ""}. {cf.note ? <>Reason: “{cf.note}”</> : null}
          {cf.resolution === "deferred" && " Both sides go to the successor under “Still unresolved”. You can still settle it now."}
        </p>
      ) : null}

      {!settled && (
        <fieldset className="mt-4 rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-sm font-semibold">Your decision</legend>
          <div className="flex flex-wrap gap-2 text-sm">
            {(["both_true", "correct", "defer"] as ConflictAction[]).map((a) => (
              <label key={a} className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 ${action === a ? "border-indigo-600 bg-indigo-50" : "border-slate-300"}`}>
                <input type="radio" name={`act-${cf.id}`} checked={action === a} onChange={() => { setAction(a); setKeep(null); }} />
                {{ both_true: "Both are true (explain the scope)", correct: "Neither is right: write the correct version", defer: "Defer: the successor follows up" }[a as "both_true" | "correct" | "defer"]}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">Or choose “Keep side …” above. Nothing is pre-selected.</p>
          {action === "both_true" && (
            <label className="mt-3 block text-sm">How both are true
              <input className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" value={scope} onChange={(e) => setScope(e.target.value)} placeholder="e.g. Render hosts the API; Vercel hosts the web app." />
            </label>
          )}
          {action === "correct" && (
            <label className="mt-3 block text-sm">The correct version
              <input className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" value={fixed} onChange={(e) => setFixed(e.target.value)} placeholder="e.g. The web app is deployed on Vercel since 2 Oct; Render is no longer used." />
            </label>
          )}
          {action && (
            <label className="mt-3 block text-sm">Reason {action === "defer" ? "(optional)" : "(who confirmed it, and how; at least 10 characters)"}
              <textarea className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Confirmed with Dev on a call: the vercel.json commits are the live setup." />
            </label>
          )}
          {err && <div className="mt-2"><Notice tone="error">{err}</Notice></div>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="primary" disabled={!action || !ready || busy} onClick={() => action && submit(action)}>{busy ? "Saving…" : label}</Button>
            {action && <Button variant="ghost" onClick={() => { setAction(null); setKeep(null); }}>Clear</Button>}
          </div>
        </fieldset>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2">
        <button className="inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline" aria-expanded={showHist} onClick={toggleHistory}>
          <History size={14} aria-hidden /> History {showHist ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {(settled || cf.resolution === "deferred") && (
          <button className="inline-flex items-center gap-1 text-sm text-slate-700 hover:underline" disabled={busy} onClick={() => { if (window.confirm("Reopen this conflict? The previous decision is undone (it stays in the history).")) submit("reopen"); }}>
            <RotateCcw size={13} aria-hidden /> Reopen
          </button>
        )}
      </div>
      {showHist && (
        <ol className="mt-2 space-y-1.5 border-l-2 border-slate-200 pl-3 text-sm" aria-label="Decision history">
          {!hist && <li className="text-slate-500">Loading…</li>}
          {hist?.map((h, i) => (
            <li key={i}><span className="text-xs text-slate-500">{fmtDateTime(h.at)} · {h.actor}</span><br /><b>{EVENT[h.action]}</b>{h.note ? ` — “${h.note}”` : ""}</li>
          ))}
        </ol>
      )}
    </Card>
  );
}
