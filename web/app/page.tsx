"use client";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowRight, BadgeCheck, CircleHelp, ClipboardCheck, Eye, FileSearch, GitBranch, History,
  Lightbulb, LockKeyhole, MessageSquareText, Mic, Network, ScanSearch, ShieldCheck, Sparkles, UserRoundCheck,
} from "lucide-react";
import { ROLE_META, useSession } from "@/lib/session";
import type { Role } from "@/lib/types";

const ICON = { lead: ClipboardCheck, contributor: UserRoundCheck, leaver: Mic };
const ORDER: Role[] = ["lead", "leaver", "contributor"];
const TAG: Record<Role, string> = { lead: "1 · Start here", leaver: "2 · Then answer", contributor: "3 · Finally receive" };

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
  { icon: BadgeCheck, n: "Verified", d: "A source states it and a check confirmed it.", cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" },
  { icon: Lightbulb, n: "Inferred", d: "AI inference, not stated in any source.", cls: "border-amber-400/50 border-dashed bg-amber-400/10 text-amber-200" },
  { icon: AlertTriangle, n: "Conflicting", d: "Sources disagree. Both are shown.", cls: "border-rose-400/40 bg-rose-400/10 text-rose-200" },
  { icon: CircleHelp, n: "Missing", d: "Needed, but no evidence. Becomes a question.", cls: "border-slate-400/50 border-dashed bg-slate-400/10 text-slate-200" },
  { icon: ShieldCheck, n: "Confirmed", d: "A person confirmed or corrected it.", cls: "border-indigo-400/40 bg-indigo-400/10 text-indigo-200" },
];

function Example({ state, text, src, cls, Icon }: { state: string; text: string; src: string; cls: string; Icon: typeof BadgeCheck }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur">
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}><Icon size={13} aria-hidden /> {state}</span>
      <p className="mt-2 text-sm font-medium text-slate-100">{text}</p>
      <span className="mt-2 inline-flex items-center gap-1 rounded-md border border-indigo-300/30 bg-indigo-400/10 px-2 py-0.5 text-xs font-medium text-indigo-200"><MessageSquareText size={12} aria-hidden /> {src}</span>
    </div>
  );
}

export default function Landing() {
  const { setRole } = useSession();
  const router = useRouter();
  const enter = (r: Role) => {
    setRole(r);
    router.push(`/handovers`);
  };
  return (
    <div className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-indigo-600/35 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-40 top-40 h-[34rem] w-[34rem] rounded-full bg-fuchsia-600/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />

      {/* Hero + demo entry, both above the fold */}
      <section id="demo" className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 sm:pt-14 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-indigo-100">
            <Sparkles size={13} aria-hidden /> CodeFrontier · Problem 01 · Team BINARY BUILDERS
          </span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl xl:text-6xl">
            Project handovers that{" "}
            <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">show their work.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
            When someone leaves, Continuum rebuilds the project&apos;s current state from its repo, chat, notes and issues. Every statement links to its source, uncertainty is labelled instead of hidden, and a reviewer approves exactly what the successor may see.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2 text-xs text-slate-200">
            {["Every claim cites its source", "Uncertainty is labelled", "Role-based access", "No sign-in needed"].map((x) => (
              <li key={x} className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1"><BadgeCheck size={12} aria-hidden /> {x}</li>
            ))}
          </ul>
          <a href="#how" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-indigo-200 hover:text-white">How it works <ArrowRight size={15} aria-hidden /></a>
        </div>

        <div className="rounded-3xl border border-white/15 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <h2 className="text-xl font-bold">Try the demo</h2>
          <p className="mt-1 text-sm text-slate-300">
            Synthetic project <strong className="text-white">CampusKart</strong> is loaded. Aditi is leaving; Karan takes over. Pick a role, in this order:
          </p>
          <div className="mt-4 space-y-3">
            {ORDER.map((r) => {
              const Icon = ICON[r];
              return (
                <button key={r} onClick={() => enter(r)} className="group flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-left transition hover:border-indigo-300/60 hover:bg-slate-900">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 text-white shadow-lg"><Icon size={22} aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-indigo-200">{TAG[r]}</span>
                    <span className="block font-semibold text-white">Enter as {ROLE_META[r].label}</span>
                    <span className="block text-sm leading-snug text-slate-300">{ROLE_META[r].blurb}</span>
                  </span>
                  <ArrowRight className="shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-white" size={18} aria-hidden />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="relative mx-auto max-w-6xl space-y-20 px-4 pb-16">
        <section aria-label="Examples from the demo">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-300">What a handover looks like</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Example Icon={BadgeCheck} state="Verified" cls="border-emerald-400/40 bg-emerald-400/10 text-emerald-200" text="Payments moved from a card gateway to UPI deep links in August because of merchant KYC." src="PR #87 · quote matched" />
            <Example Icon={AlertTriangle} state="Conflicting" cls="border-rose-400/40 bg-rose-400/10 text-rose-200" text="README says Render, but commits since 2 Oct configure Vercel. Both shown, not auto-resolved." src="README · commits since 2 Oct" />
            <Example Icon={CircleHelp} state="Missing" cls="border-slate-400/50 border-dashed bg-slate-400/10 text-slate-200" text="Who owns the college SMTP account? No source says. Asked to the leaver." src="Gap Interview question" />
          </div>
          <p className="mt-3 text-xs text-slate-400">Illustrative examples from the synthetic CampusKart demo.</p>
        </section>

        <section id="how" className="scroll-mt-24">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">From scattered activity to a handover you can check</h2>
          <p className="mt-2 max-w-2xl text-slate-300">Five steps. Nothing reaches the successor without passing a check and a human.</p>
          <ol className="mt-6 grid gap-4 md:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.t} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:-translate-y-0.5 hover:border-indigo-300/40 hover:bg-white/[0.07]">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-400/15 text-indigo-200"><s.icon size={20} aria-hidden /></span>
                  <span className="text-xs font-bold text-slate-300">0{i + 1}</span>
                </div>
                <h3 className="mt-3 font-semibold">{s.t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-300">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Built so it cannot bluff</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.t} className="flex gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 text-white"><f.icon size={20} aria-hidden /></span>
                <div>
                  <h3 className="font-semibold">{f.t}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-300">{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How to read the badges</h2>
          <p className="mt-2 max-w-2xl text-slate-300">Every claim carries one of five evidence states, shown as an icon plus text, never colour alone.</p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {STATES.map((s) => (
              <li key={s.n} className={`rounded-xl border p-3 ${s.cls}`}>
                <div className="flex items-center gap-1.5 font-semibold"><s.icon size={16} aria-hidden /> {s.n}</div>
                <p className="mt-1 text-sm">{s.d}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-white/15 bg-gradient-to-r from-indigo-600/30 to-fuchsia-600/30 p-8 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">See a handover that shows its work</h2>
          <p className="mx-auto mt-2 max-w-xl text-slate-200">Open the demo as the reviewer and click any source chip to read the original text behind a claim.</p>
          <button onClick={() => enter("lead")} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-indigo-50">
            Start as Reviewer <ArrowRight size={16} aria-hidden />
          </button>
        </section>
      </div>
    </div>
  );
}
