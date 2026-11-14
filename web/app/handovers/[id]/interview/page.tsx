"use client";
import { use, useCallback, useEffect, useState } from "react";
import { CheckCircle2, MessageCircleQuestion, SkipForward } from "lucide-react";
import { api, type GapWithEvidence } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Task } from "@/lib/types";
import { Button, Card, Notice, PageTitle, fmtDate } from "@/components/ui";
import { HandoverNav, RoleGuard, notifyChanged } from "@/components/shell";
import { SECTION_TITLE } from "@/components/version-diff";
import { EmptyState, LoadError, SkeletonList } from "@/components/feedback";
import { friendlyError } from "@/lib/status";

export default function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { role } = useSession();
  const [tab, setTab] = useState<"gaps" | "successor">("gaps");
  const [gaps, setGaps] = useState<GapWithEvidence[] | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [text, setText] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const [g, t] = await Promise.all([api.getGaps(id, true), api.getTasks(id)]);
      setGaps(g);
      setTasks(t);
    } catch (e) {
      setLoadErr(friendlyError(e));
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    // open on the successor tab when they are waiting and the gap questions are done
    if (gaps && tasks && gaps.every((g) => g.status !== "open") && tasks.some((t) => t.status === "open")) setTab("successor");
  }, [gaps, tasks]);

  async function answer(gid: string) {
    setErr(null);
    try {
      await api.answerGap(gid, { answer: text[gid] ?? "" });
      notifyChanged();
      await load();
    } catch (e) {
      setErr(friendlyError(e));
    }
  }
  async function answerTask(tid: string) {
    setErr(null);
    try {
      await api.answerTask(tid, text[tid] ?? "");
      notifyChanged();
      await load();
    } catch (e) {
      setErr(friendlyError(e));
    }
  }
  async function skip(gid: string) {
    await api.skipGap(gid);
    notifyChanged();
    await load();
  }

  const total = gaps?.length ?? 0;
  const done = gaps?.filter((g) => g.status !== "open").length ?? 0;
  const openTasks = tasks?.filter((t) => t.status === "open").length ?? 0;
  const tabCls = (on: boolean) => `rounded-md px-3 py-1.5 text-sm font-medium ${on ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"}`;

  return (
    <RoleGuard hid={id} allow={["leaver", "lead"]}>
      <HandoverNav hid={id} />
      <PageTitle title="Gap Interview" sub="Continuum read the project and asks you only what the evidence cannot answer, plus any question the successor has after reading the handover. Short answers are enough. Each answer is saved as new citable evidence (“Exit Q&A”) and the reviewer decides how to use it." />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Question lists">
        <button role="tab" aria-selected={tab === "gaps"} className={tabCls(tab === "gaps")} onClick={() => setTab("gaps")}>Gap questions ({total - done} open)</button>
        <button role="tab" aria-selected={tab === "successor"} className={tabCls(tab === "successor")} onClick={() => setTab("successor")}>From your successor ({openTasks} waiting)</button>
      </div>
      {err && <div className="mb-3"><Notice tone="error">{err}</Notice></div>}
      {loadErr && <LoadError message={loadErr} onRetry={load} />}
      {!gaps && !loadErr && <SkeletonList rows={2} label="Loading questions" />}

      {tab === "gaps" && gaps && (
        <>
          <div className="mb-4" aria-live="polite">
            <div className="flex justify-between text-sm"><span>{done} of {total} handled</span>{total > 0 && done === total && <span className="font-medium text-emerald-800">All done. Thank you.</span>}</div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-emerald-600" style={{ width: total ? `${(done / total) * 100}%` : "0%" }} /></div>
          </div>
          {gaps.length === 0 && <EmptyState title="No open questions" hint="Run Reconstruct first if you expected some." />}
          <div className="space-y-4">
            {gaps.map((g, i) => (
              <Card key={g.id}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Question {i + 1} of {total}</p>
                <h2 className="mt-1 font-semibold">{g.question}</h2>
                <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                  <div className="rounded-md bg-slate-50 p-3">
                    <div className="mb-1 text-xs font-semibold text-slate-600">What we found</div>
                    <ul className="space-y-1.5">
                      {(g.evidence ?? []).map((e) => <li key={e.id}><span className="font-medium">{e.source_name ?? "Source"}</span> · <i>{e.author}</i>, {fmtDate(e.ts)}: “{e.text}”</li>)}
                      {!(g.evidence ?? []).length && <li className="text-slate-500">No source mentions it at all.</li>}
                    </ul>
                  </div>
                  <div className="rounded-md bg-slate-50 p-3">
                    <div className="mb-1 text-xs font-semibold text-slate-600">What is missing</div>
                    <p>No source names the answer. We will not guess, so we are asking you.</p>
                  </div>
                </div>
                {g.status === "open" && role === "leaver" ? (
                  <AnswerBox value={text[g.id] ?? ""} onChange={(v) => setText({ ...text, [g.id]: v })} onSave={() => answer(g.id)} onSkip={() => skip(g.id)} />
                ) : g.status === "open" ? (
                  <p className="mt-3 text-sm text-slate-600">Waiting for the leaver.</p>
                ) : (
                  <p className={`mt-3 inline-flex items-center gap-1.5 text-sm ${g.status === "answered" ? "text-emerald-800" : "text-slate-600"}`}>
                    <CheckCircle2 size={15} aria-hidden /> {g.status === "answered" ? <>Answered: “{g.answer}”. Saved as Exit Q&A evidence; waiting for reviewer approval.</> : "Skipped. This stays listed as Missing in the handover."}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {tab === "successor" && tasks && (
        <>
          {tasks.length === 0 && <EmptyState title="No questions from the successor yet" hint="When they flag a section as unclear, the question appears here." />}
          <div className="space-y-4">
            {tasks.map((t) => (
              <Card key={t.id}>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <MessageCircleQuestion size={14} aria-hidden /> {t.raised_by} · {t.section ? SECTION_TITLE[t.section] : "General"} · v{t.version_raised}
                </div>
                <h2 className="mt-1 font-semibold">“{t.text}”</h2>
                {t.status === "open" && role === "leaver" ? (
                  <AnswerBox value={text[t.id] ?? ""} onChange={(v) => setText({ ...text, [t.id]: v })} onSave={() => answerTask(t.id)} />
                ) : t.answer ? (
                  <p className="mt-2 inline-flex items-start gap-1.5 text-sm text-emerald-800"><CheckCircle2 size={15} className="mt-0.5" aria-hidden /> Answered by {t.answer_by}: “{t.answer}”{t.status === "resolved" ? " · the reviewer used it" : ""}</p>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">{t.status === "open" ? "Waiting for the leaver." : "Closed by the reviewer."}</p>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </RoleGuard>
  );
}

function AnswerBox({ value, onChange, onSave, onSkip }: { value: string; onChange: (v: string) => void; onSave: () => void; onSkip?: () => void }) {
  return (
    <div className="mt-3">
      <label className="block text-sm font-medium">Your answer
        <textarea className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm font-normal" rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Short and specific. Say “I don't know” if you don't." />
      </label>
      <div className="mt-2 flex gap-2">
        <Button variant="primary" disabled={!value.trim()} onClick={onSave}>Save answer</Button>
        {onSkip && <Button onClick={onSkip}><SkipForward size={14} aria-hidden /> Skip</Button>}
      </div>
      <p className="mt-2 text-xs text-slate-500">Do not paste passwords or keys (they are refused). Say who holds them instead.</p>
    </div>
  );
}
