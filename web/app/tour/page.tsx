"use client";
// Judge's tour: the whole product in about 5 minutes. Each step switches role, makes sure this visitor has their
// own demo copy, and opens the right screen. Progress is remembered in this browser.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Circle, Clock, Loader2 } from "lucide-react";
import { JUDGE_STEPS } from "@/components/tour";
import { ROLE_META, useSession } from "@/lib/session";
import { friendlyError } from "@/lib/status";
import { PageTitle } from "@/components/ui";

const DONE_KEY = "continuum-tour-done";
const READ_FOR: Record<string, string> = {
  ledger: "Every claim shows an evidence state (icon and text) and clickable sources.",
  conflicts: "Both sides with source, author and date. A reason is required.",
  privacy: "Masked previews only. The raw value never reaches the browser.",
  tasks: "The successor's question and the leaver's answer, with three ways to use it.",
  start: "A panel with before and after text, and only changed sections ask again.",
  interview: "Short answers; a pasted key is refused.",
  activity: "Press Verify integrity: the chain of fingerprints is checked.",
};
const IMPROVEMENT: Record<number, string> = {
  1: "Improvement 1 · cross-source conflicts",
  2: "Improvement 3 · sensitive data",
  3: "Improvement 2 · acknowledgement loop",
  4: "Improvement 2 · acknowledgement loop",
  5: "Improvement 2 · acknowledgement loop",
  6: "Improvement 3 · audit trail",
};

export default function TourPage() {
  const { setRole, ensureDemo } = useSession();
  const router = useRouter();
  const [done, setDone] = useState<number[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDone(JSON.parse(window.localStorage.getItem(DONE_KEY) ?? "[]"));
    } catch {
      setDone([]);
    }
  }, []);
  const mark = (i: number) => {
    const next = [...new Set([...done, i])];
    setDone(next);
    try {
      window.localStorage.setItem(DONE_KEY, JSON.stringify(next));
    } catch {}
  };

  async function go(i: number) {
    const g = JUDGE_STEPS[i].go;
    if (!g) return;
    setErr(null);
    setBusy(i);
    try {
      setRole(g.role);
      const hid = await ensureDemo();
      mark(i);
      router.push(`/handovers/${hid}/${g.path}`);
    } catch (e) {
      setErr(friendlyError(e));
      setBusy(null);
    }
  }

  const pct = Math.round((done.length / JUDGE_STEPS.length) * 100);
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle
        title="Judge's tour"
        sub={<>The whole product in about {JUDGE_STEPS.length} minutes, with no sign-in and no typing beyond two short notes. Every button below switches to the right role and opens the right screen of <b>your own copy</b> of the CampusKart demo, so nothing you do affects anyone else.</>}
      />
      <div className="mb-5 rounded-lg border border-slate-200 bg-white p-3" aria-live="polite">
        <div className="flex items-center justify-between text-sm"><span className="font-medium text-slate-800">{done.length} of {JUDGE_STEPS.length} steps visited</span><span className="text-slate-500">{pct}%</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Tour progress"><div className="h-full bg-blue-700 transition-all" style={{ width: `${pct}%` }} /></div>
      </div>
      {err && <p role="alert" className="mb-3 rounded-md border border-rose-300 bg-rose-50 p-2 text-sm text-rose-900">{err}</p>}

      <ol className="space-y-3">
        {JUDGE_STEPS.map((s, i) => {
          const seen = done.includes(i);
          const imp = IMPROVEMENT[i];
          return (
            <li key={i} className={`rounded-xl border bg-white p-4 shadow-sm ${seen ? "border-emerald-300" : "border-slate-200"}`}>
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${seen ? "bg-emerald-600" : "bg-blue-700"}`} aria-hidden>
                  {seen ? <CheckCircle2 size={18} /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900"><span className="sr-only">Step {i + 1}: </span>{s.title}</h2>
                    {s.go && <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">as {ROLE_META[s.go.role].short}</span>}
                    {imp && <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-900">{imp}</span>}
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Clock size={12} aria-hidden /> about 1 min</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{s.body}</p>
                  {s.go && READ_FOR[s.go.path] && <p className="mt-1 text-xs text-slate-600"><b>Look for:</b> {READ_FOR[s.go.path]}</p>}
                  {s.go && (
                    <button onClick={() => go(i)} disabled={busy !== null} aria-busy={busy === i} className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-70">
                      {busy === i ? <><Loader2 size={14} className="animate-spin" aria-hidden /> Preparing your copy…</> : <>{s.go.label} <ArrowRight size={14} aria-hidden /></>}
                    </button>
                  )}
                </div>
                {!seen && <Circle className="mt-1 hidden text-slate-300 sm:block" size={18} aria-hidden />}
              </div>
            </li>
          );
        })}
      </ol>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4" aria-labelledby="where">
        <h2 id="where" className="text-base font-semibold text-slate-900">Where each Round 3 improvement lives</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          <li><b>1 · Conflicts across sources:</b> step 2 (side by side, a reason for every decision, a history, a reopen).</li>
          <li><b>2 · Acknowledgement loop and version diff:</b> steps 4 to 6 (a flag becomes a question, the leaver answers, v2 shows what changed).</li>
          <li><b>3 · Sensitive data:</b> step 3 (masked items and the review queue), step 7 (tamper-evident log), and the Guest view from the home page.</li>
        </ul>
        <p className="mt-3 text-sm"><Link href="/" className="font-medium text-blue-700 underline">Back to the home page</Link>. Press Help (top right) any time for the same steps as a small pop-up.</p>
      </section>
    </div>
  );
}
