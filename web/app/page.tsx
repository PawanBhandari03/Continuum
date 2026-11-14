"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle, ArrowRight, BadgeCheck, CircleHelp, ClipboardCheck, Eye, FileSearch, GitBranch, History,
  Lightbulb, Loader2, LockKeyhole, MessageSquareText, Mic, Network, ScanSearch, ShieldCheck, UserRoundCheck, Globe2,
} from "lucide-react";
import { ROLE_META, useSession } from "@/lib/session";
import { friendlyError } from "@/lib/status";
import type { Role } from "@/lib/types";

const ICON = { lead: ClipboardCheck, contributor: UserRoundCheck, leaver: Mic, guest: Globe2 };
const ORDER: Role[] = ["lead", "leaver", "contributor"];
const TAG: Record<Role, string> = { lead: "Step 1", leaver: "Step 2", contributor: "Step 3", guest: "Optional" };

const STEPS = [
  { icon: GitBranch, t: "Connect", d: "Repo, chat export, notes and issues. Secrets and personal data are masked on the way in." },
  { icon: Network, t: "Reconstruct", d: "The AI extracts small claims. Each one must cite the exact evidence it came from." },
  { icon: ScanSearch, t: "Verify", d: "Code checks every quote. A second check decides if the source really supports the claim." },
  { icon: FileSearch, t: "Review", d: "A reviewer approves, edits, rejects or redacts each claim. Conflicts are never auto-resolved." },
  { icon: Eye, t: "Handover", d: "The successor sees only what their role may read, and can flag anything unclear." },
];
const FEATURES = [
  { icon: BadgeCheck, t: "Claims, not summaries", d: "A handover is a list of atomic statements. Each has an evidence state and source links, so you can check it line by line." },
  { icon: Mic, t: "Gap Interview", d: "The leaver answers only the questions the evidence cannot answer. Answers become new citable evidence." },
  { icon: LockKeyhole, t: "Permission before generation", d: "Lead-only text is processed in a separate pass. A claim is shown only if the viewer may read all of its evidence." },
  { icon: History, t: "A loop, not a document", d: "Version history, a publish lock, and acknowledge or flag-as-unclear for every section." },
];
const STATES = [
  { icon: BadgeCheck, n: "Verified", d: "A source states it and a check confirmed it.", cls: "border-emerald-300 bg-emerald-50 text-emerald-900" },
  { icon: Lightbulb, n: "Inferred", d: "AI inference, not stated in any source.", cls: "border-amber-300 border-dashed bg-amber-50 text-amber-900" },
  { icon: AlertTriangle, n: "Conflicting", d: "Sources disagree. Both are shown.", cls: "border-rose-300 bg-rose-50 text-rose-900" },
  { icon: CircleHelp, n: "Missing", d: "Needed, but no evidence. Becomes a question.", cls: "border-slate-400 border-dashed bg-slate-100 text-slate-800" },
  { icon: ShieldCheck, n: "Confirmed", d: "A person confirmed or corrected it.", cls: "border-blue-300 bg-blue-50 text-blue-900" },
];

function Example({ state, text, src, cls, Icon }: { state: string; text: string; src: string; cls: string; Icon: typeof BadgeCheck }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm">
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}><Icon size={13} aria-hidden /> {state}</span>
      <p className="mt-2 text-sm font-medium text-slate-900">{text}</p>
      <span className="mt-2 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700"><MessageSquareText size={12} aria-hidden /> {src}</span>
    </div>
  );
}

export default function Landing() {
  const { setRole, ensureDemo } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState<Role | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const enter = async (r: Role) => {
    setErr(null);
    setBusy(r);
    setRole(r);
    try {
      const hid = await ensureDemo();
      router.push(ROLE_META[r].home(hid));
    } catch (e) {
      setErr(friendlyError(e));
      setBusy(null);
    }
  };
  return (
    <div className="space-y-16 pb-6">
      {/* Headline and demo entry, both above the fold */}
      <section id="demo" className="grid items-center gap-10 pt-4 lg:grid-cols-[1.1fr_1fr] lg:pt-10">
        <div>
          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl xl:text-6xl">
            Project handovers that <span className="text-blue-700">show their work.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
            When someone leaves, Continuum rebuilds the project&apos;s current state from its repo, chat, notes and issues. Every statement links to its source, uncertainty is labelled instead of hidden, and a reviewer approves exactly what the successor may see.
          </p>
          <ul className="mt-6 grid max-w-xl gap-2 text-sm text-slate-700 sm:grid-cols-2">
            {["Every claim cites its source", "Uncertainty is labelled, never hidden", "Each version signed and frozen", "No sign-in needed for the demo"].map((x) => (
              <li key={x} className="flex items-center gap-2"><BadgeCheck className="shrink-0 text-blue-700" size={16} aria-hidden /> {x}</li>
            ))}
          </ul>
          <a href="#how" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900">How it works <ArrowRight size={15} aria-hidden /></a>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg sm:p-6">
          <h2 className="text-xl font-bold text-slate-900">Try the demo</h2>
          <p className="mt-1 text-sm text-slate-600">
            The synthetic project <strong className="text-slate-900">CampusKart</strong> is loaded. Aditi is leaving; Karan takes over. Pick a role, in this order:
          </p>
          <div className="mt-4 space-y-3">
            {ORDER.map((r) => {
              const Icon = ICON[r];
              return (
                <button key={r} onClick={() => enter(r)} disabled={busy !== null} aria-busy={busy === r} className="group flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-600 hover:bg-blue-50/50 disabled:cursor-wait disabled:opacity-80">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white">{busy === r ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <Icon size={20} aria-hidden />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-blue-700">{TAG[r]}</span>
                    <span className="block font-semibold text-slate-900">Enter as {ROLE_META[r].label}</span>
                    <span className="block text-sm leading-snug text-slate-600">{ROLE_META[r].blurb}</span>
                  </span>
                  <ArrowRight className="shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-700" size={18} aria-hidden />
                </button>
              );
            })}
          </div>
          {busy && <p className="mt-3 text-sm text-slate-600" role="status">Preparing your own copy of the demo, so nothing you do affects other visitors. This takes a few seconds (up to a minute if the free server was asleep).</p>}
          {err && <p className="mt-3 text-sm text-rose-800" role="alert">{err}</p>}
          <button onClick={() => enter("guest")} disabled={busy !== null} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900 disabled:opacity-60">
            <Globe2 size={15} aria-hidden /> Or enter as Guest: see only what is public
          </button>
          <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">Works even when the AI is unavailable: a rule-based fallback finds all 8 planted facts in this demo on its own, and every claim says how it was made.</p>
        </div>
      </section>

      <section aria-label="Examples from the demo">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">What a handover looks like</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Example Icon={BadgeCheck} state="Verified" cls="border-emerald-300 bg-emerald-50 text-emerald-900" text="Payments moved from a card gateway to UPI deep links in August because of merchant KYC." src="PR #87 · quote matched" />
          <Example Icon={AlertTriangle} state="Conflicting" cls="border-rose-300 bg-rose-50 text-rose-900" text="README says Render, but commits since 2 Oct configure Vercel. Both shown, not auto-resolved." src="README · commits since 2 Oct" />
          <Example Icon={CircleHelp} state="Missing" cls="border-slate-400 border-dashed bg-slate-100 text-slate-800" text="Who owns the college SMTP account? No source says. Asked to the leaver." src="Gap Interview question" />
        </div>
        <p className="mt-3 text-xs text-slate-500">Illustrative examples from the synthetic CampusKart demo.</p>
      </section>

      <section id="how" className="scroll-mt-24">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">From scattered activity to a handover you can check</h2>
        <p className="mt-2 max-w-2xl text-slate-600">Five steps. Nothing reaches the successor without passing a check and a human.</p>
        <ol className="mt-6 grid gap-4 md:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.t} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><s.icon size={20} aria-hidden /></span>
                <span className="text-xs font-bold text-slate-500">0{i + 1}</span>
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">{s.t}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Built so it cannot bluff</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.t} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white"><f.icon size={20} aria-hidden /></span>
              <div>
                <h3 className="font-semibold text-slate-900">{f.t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">How to read the badges</h2>
        <p className="mt-2 max-w-2xl text-slate-600">Every claim carries one of five evidence states, shown as an icon plus text, never colour alone.</p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STATES.map((s) => (
            <li key={s.n} className={`rounded-xl border p-3 ${s.cls}`}>
              <div className="flex items-center gap-1.5 font-semibold"><s.icon size={16} aria-hidden /> {s.n}</div>
              <p className="mt-1 text-sm">{s.d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-slate-900 p-8 text-center text-white">
        <h2 className="text-2xl font-bold sm:text-3xl">See a handover that shows its work</h2>
        <p className="mx-auto mt-2 max-w-xl text-slate-300">Open the demo as the reviewer and click any source chip to read the original text behind a claim.</p>
        <button onClick={() => enter("lead")} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-blue-50">
          Start as Reviewer <ArrowRight size={16} aria-hidden />
        </button>
      </section>
    </div>
  );
}
