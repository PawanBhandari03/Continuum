"use client";
// Judge's tour: the whole product in about 5 minutes. Each step switches role, makes sure this visitor has their
// own demo copy, and opens the right screen. Progress is remembered in this browser.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Circle, Clock, Loader2, Sparkles } from "lucide-react";
import { JUDGE_STEPS } from "@/components/tour";
import { ROLE_META, useSession } from "@/lib/session";
import { friendlyError } from "@/lib/status";

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
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border border-[#e5dfd6] bg-white p-6 shadow-2xs">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#b8c8ee] bg-[#eef3fd] px-3.5 py-1 text-xs font-semibold text-[#2b3e70] shadow-2xs mb-3">
          <Sparkles size={13} className="text-[#506cb8]" /> Hackathon Evaluation Walkthrough
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[#25272d] sm:text-4xl">Judge&apos;s Tour</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#575245]">
          The whole product in about {JUDGE_STEPS.length} minutes, with no sign-in and no typing beyond two short notes. Every button below switches to the right role and opens the right screen of <b>your own copy</b> of the CampusKart demo, so nothing you do affects anyone else.
        </p>
      </div>

      <div className="rounded-2xl border border-[#e5dfd6] bg-white p-4 shadow-2xs" aria-live="polite">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-[#25272d]">{done.length} of {JUDGE_STEPS.length} steps visited</span>
          <span className="font-bold text-[#506cb8]">{pct}% Completed</span>
        </div>
        <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-[#f4efea] border border-[#e5dfd6]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Tour progress">
          <div className="h-full bg-[#92a9e1] transition-all duration-500 rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {err && <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 shadow-2xs">{err}</p>}

      <ol className="space-y-3.5">
        {JUDGE_STEPS.map((s, i) => {
          const seen = done.includes(i);
          const imp = IMPROVEMENT[i];
          return (
            <li key={i} className={`rounded-2xl border bg-white p-5 shadow-2xs transition-all hover:shadow-sm ${seen ? "border-[#b8c8ee] ring-1 ring-[#92a9e1]/40" : "border-[#e5dfd6] hover:border-[#b8c8ee]"}`}>
              <div className="flex items-start gap-3.5">
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-2xs ${seen ? "bg-[#eef3fd] text-[#2b3e70] border border-[#b8c8ee]" : "bg-[#faf7f2] text-[#25272d] border border-[#e5dfd6]"}`} aria-hidden>
                  {seen ? <CheckCircle2 size={18} className="text-[#506cb8]" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-[#25272d]"><span className="sr-only">Step {i + 1}: </span>{s.title}</h2>
                    {s.go && <span className="rounded-full border border-[#b8c8ee] bg-[#eef3fd] px-2.5 py-0.5 text-xs font-semibold text-[#2b3e70]">as {ROLE_META[s.go.role].short}</span>}
                    {imp && <span className="rounded-full border border-[#e5dfd6] bg-[#faf7f2] px-2.5 py-0.5 text-xs font-semibold text-[#575245]">{imp}</span>}
                    <span className="inline-flex items-center gap-1 text-xs text-[#898170]"><Clock size={12} aria-hidden /> about 1 min</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#575245]">{s.body}</p>
                  {s.go && READ_FOR[s.go.path] && <p className="mt-2 rounded-md bg-[#faf7f2] border border-[#e5dfd6] p-2 text-xs text-[#575245]"><b>What to do:</b> {READ_FOR[s.go.path]}</p>}
                  {s.go && (
                    <button onClick={() => go(i)} disabled={busy !== null} aria-busy={busy === i} className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl bg-[#25272d] px-4 py-2 text-sm font-semibold text-white shadow-2xs transition hover:bg-[#191b1f] active:scale-95 disabled:cursor-wait disabled:opacity-70">
                      {busy === i ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Preparing your copy…</> : <>{s.go.label} <ArrowRight size={15} className="text-[#92a9e1]" aria-hidden /></>}
                    </button>
                  )}
                </div>
                {!seen && <Circle className="mt-1 hidden text-[#d6ccbf] sm:block" size={18} aria-hidden />}
              </div>
            </li>
          );
        })}
      </ol>

      <section className="rounded-2xl border border-[#e5dfd6] bg-white p-5 shadow-2xs" aria-labelledby="where">
        <h2 id="where" className="text-base font-bold text-[#25272d]">Where each Round 3 improvement lives</h2>
        <ul className="mt-3 space-y-2 text-sm text-[#575245]">
          <li className="flex items-start gap-2"><span className="font-bold text-[#25272d] shrink-0">1 · Conflicts across sources:</span> <span>Step 2 (side by side, a reason for every decision, a history, a reopen).</span></li>
          <li className="flex items-start gap-2"><span className="font-bold text-[#25272d] shrink-0">2 · Acknowledgement loop and version diff:</span> <span>Steps 4 to 6 (a flag becomes a question, the leaver answers, v2 shows what changed).</span></li>
          <li className="flex items-start gap-2"><span className="font-bold text-[#25272d] shrink-0">3 · Sensitive data:</span> <span>Step 3 (masked items and the review queue), step 7 (tamper-evident log), and the Guest view from the home page.</span></li>
        </ul>
        <p className="mt-4 border-t border-zinc-100 pt-3 text-sm"><Link href="/" className="font-semibold text-zinc-900 hover:underline">Back to the home page</Link>. Press Help (top right) any time for the same steps as a small pop-up.</p>
      </section>
    </div>
  );
}
