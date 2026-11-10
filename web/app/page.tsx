"use client";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CircleHelp,
  ClipboardCheck,
  Eye,
  FileSearch,
  GitBranch,
  History,
  Lightbulb,
  LockKeyhole,
  MessageSquareText,
  Mic,
  Network,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import { ROLE_META, useSession } from "@/lib/session";
import type { Role } from "@/lib/types";

const ICON = { lead: ClipboardCheck, contributor: UserRoundCheck, leaver: Mic };
const ORDER: Role[] = ["lead", "leaver", "contributor"];
const TAG: Record<Role, string> = { lead: "Start here", leaver: "Then answer", contributor: "Finally receive" };

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
  { icon: ShieldCheck, n: "Confirmed", d: "A person confirmed or corrected it.", cls: "border-indigo-300 bg-indigo-50 text-indigo-900" },
];

function PreviewClaim({ state, text, src, cls, Icon }: { state: string; text: string; src: string; cls: string; Icon: typeof BadgeCheck }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white p-3 text-left shadow-lg">
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>
        <Icon size={13} aria-hidden /> {state}
      </span>
      <p className="mt-2 text-sm font-medium text-slate-900">{text}</p>
      <span className="mt-2 inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-900">
        <MessageSquareText size={12} aria-hidden /> {src}
      </span>
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
    <div className="-mt-6 space-y-16 pb-8">
      {/* Hero */}
      <section className="relative -mx-4 overflow-hidden bg-slate-950 px-4 py-16 text-white sm:rounded-b-3xl sm:py-20">
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-indigo-600/40 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-fuchsia-600/25 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-indigo-100">
              <Sparkles size={13} aria-hidden /> CodeFrontier · Problem 01 · Team BINARY BUILDERS
            </span>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Project handovers that{" "}
              <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">show their work.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
              When someone leaves, Continuum rebuilds the project&apos;s current state from its repo, chat, notes and issues. Every statement links to its source, uncertainty is labelled instead of hidden, and a reviewer approves exactly what the successor may see.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a href="#demo" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-indigo-50">
                Try the demo <ArrowRight size={16} aria-hidden />
              </a>
              <a href="#how" className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                How it works
              </a>
            </div>
            <p className="mt-4 text-sm text-slate-400">Illustrative examples from the demo. No sign-in. Synthetic project &quot;CampusKart&quot; is already loaded.</p>
          </div>

          <div aria-hidden className="relative mx-auto w-full max-w-md space-y-3">
            <PreviewClaim Icon={BadgeCheck} state="Verified" cls="border-emerald-300 bg-emerald-50 text-emerald-900" text="Payments moved from a card gateway to UPI deep links in August because of merchant KYC." src="PR #87 · quote matched" />
            <div className="ml-6">
              <PreviewClaim Icon={AlertTriangle} state="Conflicting" cls="border-rose-300 bg-rose-50 text-rose-900" text="README says Render, but commits since 2 Oct configure Vercel. Both shown, not auto-resolved." src="README · commits since 2 Oct" />
            </div>
            <PreviewClaim Icon={CircleHelp} state="Missing" cls="border-slate-400 border-dashed bg-slate-100 text-slate-800" text="Who owns the college SMTP account? No source says. Asked to the leaver." src="Gap Interview question" />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">From scattered activity to a handover you can check</h2>
        <p className="mt-2 max-w-2xl text-slate-600">Five steps. Nothing reaches the successor without passing a check and a human.</p>
        <ol className="mt-6 grid gap-4 md:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.t} className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><s.icon size={20} aria-hidden /></span>
                <span className="text-xs font-bold text-slate-600">0{i + 1}</span>
              </div>
              <h3 className="mt-3 font-semibold">{s.t}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Built so it cannot bluff</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.t} className="flex gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white"><f.icon size={20} aria-hidden /></span>
              <div>
                <h3 className="font-semibold">{f.t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Evidence states */}
      <section>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How to read the badges</h2>
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

      {/* Demo */}
      <section id="demo" className="scroll-mt-20 rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 p-6 sm:p-8">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Try the demo. No sign-in needed.</h2>
        <p className="mt-2 max-w-3xl text-slate-700">
          A synthetic project, <strong>CampusKart</strong>, is already loaded. Aditi is leaving; Karan takes over. Pick a role. Suggested order: <strong>Reviewer</strong> (inspect and approve) → <strong>Leaver</strong> (answer questions) → <strong>Reviewer</strong> (publish) → <strong>Successor</strong>.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {ORDER.map((r) => {
            const Icon = ICON[r];
            return (
              <div key={r} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-700 text-white"><Icon size={22} aria-hidden /></span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{TAG[r]}</span>
                </div>
                <h3 className="mt-3 text-lg font-semibold">{ROLE_META[r].label}</h3>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-600">{ROLE_META[r].blurb}</p>
                <button onClick={() => enter(r)} className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-700 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-800">
                  Enter as {ROLE_META[r].label} <ArrowRight size={15} aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
