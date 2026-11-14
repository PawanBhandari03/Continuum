"use client";
import { use, useCallback, useEffect, useState } from "react";
import { CheckCircle2, Link2, MessageCircleQuestion, PlusCircle, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import type { Claim, Task } from "@/lib/types";
import { Button, Card, Notice, PageTitle, fmtDateTime } from "@/components/ui";
import { HandoverNav, RoleGuard, notifyChanged } from "@/components/shell";
import { SECTION_TITLE } from "@/components/version-diff";
import { EmptyState, LoadError, SkeletonList } from "@/components/feedback";
import { friendlyError } from "@/lib/status";

const STATUS: Record<Task["status"], { label: string; cls: string }> = {
  open: { label: "Waiting for the leaver", cls: "border-amber-300 bg-amber-50 text-amber-900" },
  answered: { label: "Answered: needs your decision", cls: "border-rose-300 bg-rose-50 text-rose-900" },
  resolved: { label: "Resolved", cls: "border-emerald-300 bg-emerald-50 text-emerald-900" },
  wont_fix: { label: "Closed without change", cls: "border-slate-300 bg-slate-50 text-slate-800" },
};

export default function TasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const [t, c] = await Promise.all([api.getTasks(id), api.getClaims(id)]);
      setTasks(t);
      setClaims(c);
    } catch (e) {
      setLoadErr(friendlyError(e));
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  const order: Task["status"][] = ["answered", "open", "resolved", "wont_fix"];
  const sorted = [...(tasks ?? [])].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  return (
    <RoleGuard hid={id} allow={["lead"]}>
      <HandoverNav hid={id} />
      <PageTitle
        title="Questions from the successor"
        sub="When the successor flags a section as unclear, the question goes to the leaver (while they are still reachable) and to you. Use the leaver's answer to improve the handover, then publish the next version: the successor sees exactly what changed."
      />
      {loadErr && <LoadError message={loadErr} onRetry={load} />}
      {!tasks && !loadErr && <SkeletonList rows={2} label="Loading questions" />}
      {tasks?.length === 0 && <EmptyState title="No questions yet" hint="Flags from the successor's “This is unclear” button appear here." />}
      <div className="space-y-4">
        {sorted.map((t) => <TaskCard key={t.id} task={t} claims={claims} onChanged={load} />)}
      </div>
    </RoleGuard>
  );
}

function TaskCard({ task: t, claims, onChanged }: { task: Task; claims: Claim[]; onChanged: () => Promise<void> }) {
  const [mode, setMode] = useState<"attach" | "new_claim" | "resolve" | "wont_fix" | null>(null);
  const [claimId, setClaimId] = useState("");
  const [statement, setStatement] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const closed = t.status === "resolved" || t.status === "wont_fix";
  const inSection = claims.filter((c) => (!t.section || c.section === t.section) && c.review_status !== "rejected" && c.review_status !== "superseded");
  const picked = claims.find((c) => c.id === claimId);
  const linked = t.claim_id ? claims.find((c) => c.id === t.claim_id) : null;

  async function submit() {
    if (!mode) return;
    setBusy(true);
    setErr(null);
    try {
      await api.resolveTask(t.id, { action: mode, claim_id: claimId || undefined, statement: statement || undefined, note });
      notifyChanged();
      setMode(null);
      await onChanged();
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  const ok = mode === "attach" ? !!claimId : mode === "new_claim" ? true : note.trim().length >= 5;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS[t.status].cls}`}>{STATUS[t.status].label}</span>
        {t.section && <span className="text-xs text-slate-600">Section: <b>{SECTION_TITLE[t.section]}</b></span>}
        <span className="text-xs text-slate-500">raised on v{t.version_raised} · {fmtDateTime(t.created_at)}</span>
      </div>
      <p className="mt-2 flex gap-2 text-sm text-slate-900"><MessageCircleQuestion size={16} className="mt-0.5 shrink-0 text-slate-500" aria-hidden /><span><b>{t.raised_by}:</b> “{t.text}”</span></p>
      {t.answer ? (
        <p className="mt-2 rounded-md bg-emerald-50 p-2 text-sm text-slate-900"><b>{t.answer_by}:</b> “{t.answer}” <span className="text-xs text-slate-600">(saved as Exit Q&A evidence)</span></p>
      ) : (
        <p className="mt-2 text-sm text-slate-600">The leaver has not answered yet. You can still close it with a reason.</p>
      )}
      {closed && (
        <p className="mt-2 text-sm text-emerald-900">
          {t.status === "resolved" ? "Resolved" : "Closed"}{t.version_resolved ? ` · goes out in v${t.version_resolved}` : ""}{t.resolution_note ? ` · ${t.resolution_note}` : ""}
          {linked && <> · claim: “{linked.statement.slice(0, 100)}{linked.statement.length > 100 ? "…" : ""}”</>}
        </p>
      )}

      {!closed && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap gap-2">
            <Button disabled={!t.answer} onClick={() => setMode("attach")} variant={mode === "attach" ? "primary" : "secondary"}><Link2 size={14} aria-hidden /> Attach answer to a claim</Button>
            <Button disabled={!t.answer} onClick={() => { setMode("new_claim"); setStatement(t.answer ?? ""); }} variant={mode === "new_claim" ? "primary" : "secondary"}><PlusCircle size={14} aria-hidden /> New claim from the answer</Button>
            <Button onClick={() => setMode("resolve")} variant={mode === "resolve" ? "primary" : "secondary"}><CheckCircle2 size={14} aria-hidden /> Already covered</Button>
            <Button onClick={() => setMode("wont_fix")} variant={mode === "wont_fix" ? "primary" : "ghost"}><XCircle size={14} aria-hidden /> Close without change</Button>
          </div>
          {mode === "attach" && (
            <div className="mt-3 space-y-2">
              <label className="block text-sm">Claim to support with this answer
                <select className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm" value={claimId} onChange={(e) => { setClaimId(e.target.value); setStatement(claims.find((c) => c.id === e.target.value)?.statement ?? ""); }}>
                  <option value="">Choose a claim{t.section ? ` in “${SECTION_TITLE[t.section]}”` : ""}…</option>
                  {inSection.map((c) => <option key={c.id} value={c.id}>{c.statement.slice(0, 120)}</option>)}
                </select>
              </label>
              {picked && (
                <label className="block text-sm">Wording (edit to include what the leaver said)
                  <textarea className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" rows={3} value={statement} onChange={(e) => setStatement(e.target.value)} />
                </label>
              )}
            </div>
          )}
          {mode === "new_claim" && (
            <label className="mt-3 block text-sm">New claim (Confirmed, cites the leaver&apos;s answer)
              <textarea className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" rows={2} value={statement} onChange={(e) => setStatement(e.target.value)} />
            </label>
          )}
          {mode && (
            <label className="mt-3 block text-sm">Note {mode === "resolve" || mode === "wont_fix" ? "(required: why)" : "(optional)"}
              <input className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === "resolve" ? "e.g. Covered in “Dependencies and people”, Meera owns the bucket." : "e.g. Added after Karan's question."} />
            </label>
          )}
          {err && <div className="mt-2"><Notice tone="error">{err}</Notice></div>}
          {mode && <div className="mt-3"><Button variant="primary" disabled={!ok || busy} onClick={submit}>{busy ? "Saving…" : "Save decision"}</Button></div>}
        </div>
      )}
    </Card>
  );
}
