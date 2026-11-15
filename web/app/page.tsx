"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  AlertTriangle, ArrowRight, BadgeCheck, CircleHelp, History,
  Lightbulb, Loader2, MessageSquareText, ShieldCheck, Globe2,
  Sparkles, Terminal, GitCommit, GitPullRequest, CheckCircle2,
  Lock, FileText, GitBranch
} from "lucide-react";
import { UserAvatar } from "@/components/avatar";
import { ROLE_META, useSession } from "@/lib/session";
import { friendlyError } from "@/lib/status";
import type { Role } from "@/lib/types";

const ORDER: Role[] = ["lead", "leaver", "contributor"];

const ROLE_INFO: Record<Role, { name: string; step: string; title: string; blurb: string }> = {
  lead: {
    name: "Engineering Lead",
    step: "Step 1 · Project Lead",
    title: "Enter as Reviewer (Lead)",
    blurb: "Review extracted claims, settle conflicting commits, redact secrets, and freeze signed v1."
  },
  leaver: {
    name: "Aditi Rao",
    step: "Step 2 · Departing Engineer",
    title: "Enter as Leaver (Aditi)",
    blurb: "Answer only what repository evidence cannot answer in a fast, targeted Gap Interview."
  },
  contributor: {
    name: "Karan Verma",
    step: "Step 3 · Successor Engineer",
    title: "Enter as Successor (Karan)",
    blurb: "Read your role-scoped 'Start Here' guide, acknowledge sections, and flag unclear code."
  },
  guest: {
    name: "Public Visitor",
    step: "Optional · Public Visitor",
    title: "Enter as Guest",
    blurb: "View only public repository claims and open-source documentation."
  }
};

const STEPS = [
  {
    stepNum: "01",
    role: "Departing Engineer",
    name: "Aditi Rao",
    avatarRole: "leaver",
    t: "Connect Sources",
    d: "Link your GitHub repository, upload Slack chat archives (.zip), and add documentation notes. API keys and student PII are masked on the way in.",
    action: "git remote add / upload dump"
  },
  {
    stepNum: "02",
    role: "Analysis Engine",
    name: "Git AST Parser",
    systemIcon: GitBranch,
    t: "Reconstruct Claims",
    d: "Continuum extracts atomic, verifiable claims from commits, PRs, and notes. Each claim is tied to its exact source and file path.",
    action: "commit & AST analysis"
  },
  {
    stepNum: "03",
    role: "Deterministic Verifier",
    name: "Rapidfuzz Auditor",
    systemIcon: ShieldCheck,
    t: "Verify Quotes",
    d: "Deterministic code checks verbatim quote matches with rapidfuzz. A narrow second pass confirms whether the evidence supports the statement.",
    action: "quote verification & match check"
  },
  {
    stepNum: "04",
    role: "Engineering Lead",
    name: "Lead Reviewer",
    avatarRole: "lead",
    t: "Review & Decide",
    d: "A human reviewer settles cross-source contradictions (e.g. README vs commits), edits text, redacts sensitive keys, and publishes.",
    action: "settle conflicts & freeze v1"
  },
  {
    stepNum: "05",
    role: "Incoming Successor",
    name: "Karan Verma",
    avatarRole: "contributor",
    t: "Handover & Loop",
    d: "The incoming engineer reads their role-scoped 'Start Here' guide, acknowledges sections, and flags anything unclear for follow-up.",
    action: "acknowledge or flag unclear"
  },
];

const STATES = [
  { icon: BadgeCheck, n: "Verified", d: "A source states it directly and deterministic code confirmed it.", cls: "border-emerald-300 bg-emerald-50 text-emerald-950" },
  { icon: Lightbulb, n: "Inferred", d: "AI inference — not stated in any source. Honestly labelled.", cls: "border-amber-300 border-dashed bg-amber-50 text-amber-950" },
  { icon: AlertTriangle, n: "Conflicting", d: "Sources disagree. Both sides shown; never auto-resolved.", cls: "border-rose-300 bg-rose-50 text-rose-950" },
  { icon: CircleHelp, n: "Missing", d: "Needed, but no evidence found. Routed to Gap Interview.", cls: "border-zinc-300 border-dashed bg-zinc-100 text-zinc-800" },
  { icon: ShieldCheck, n: "Confirmed", d: "A human reviewer or the leaver confirmed or corrected it.", cls: "border-zinc-400 bg-zinc-100 text-zinc-900" },
];

function Example({ state, text, src, cls, Icon }: { state: string; text: string; src: string; cls: string; Icon: typeof BadgeCheck }) {
  return (
    <div className="group rounded-2xl border border-[#dce3f1] bg-white p-5 text-left shadow-2xs transition-all hover:border-[#7b9bf0] hover:shadow-xs">
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
          <Icon size={13} aria-hidden /> {state}
        </span>
        <span className="font-mono text-[11px] text-[#55627f]">git:campuskart</span>
      </div>
      <p className="mt-3 text-sm font-semibold leading-relaxed text-[#0f1b3a]">{text}</p>
      <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg border border-[#dce3f1] bg-[#f6f8fd] px-2.5 py-1 text-xs font-medium text-[#455272]">
        <MessageSquareText size={12} className="text-[#55627f]" aria-hidden /> {src}
      </div>
    </div>
  );
}

export default function Landing() {
  const { setRole, ensureDemo } = useSession();
  const router = useRouter();
  useEffect(() => {
    api.getDemoProjects().catch(() => {}); // wakes the server and fills its cache before the first click
  }, []);
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
    <div className="space-y-20 pb-16">
      {/* Top Tagline Banner & Mood Pills from Theme */}
      <section id="demo" className="pt-4 lg:pt-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#b7c7f5] bg-[#e9efff] px-3.5 py-1 text-xs font-semibold text-[#1d3a9e] shadow-2xs">
            <Terminal size={14} className="text-[#2d54d6]" />
            <span>CodeFrontier 2026 · Problem 01: Prevent Critical Knowledge From Leaving With People</span>
          </div>
        </div>

        <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h1 className="text-[2.1rem] font-extrabold leading-[1.12] tracking-tight text-[#0f1b3a] sm:text-5xl xl:text-[3.4rem]">
              <span className="block">Project handovers</span>
              <span className="relative block w-fit">
                <span className="relative z-10">that show their work.</span>
                <span className="absolute bottom-1 left-0 z-0 h-3 w-full rounded bg-[#7b9bf0]/45 sm:bottom-2" aria-hidden></span>
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#455272] font-normal">
              When a developer leaves, Continuum rebuilds the project&apos;s current state directly from its Git repo, commits, chat archives, and issues. Every statement cites its source line, uncertainty is honestly labelled, and a reviewer approves exactly what the successor may read.
            </p>

            <ul className="mt-6 grid max-w-xl gap-2.5 text-sm font-medium text-[#455272] sm:grid-cols-2">
              {[
                "Every claim cites exact Git commits or docs",
                "Uncertainty is labelled, never hidden",
                "Each version signed and frozen (SHA-256)",
                "Zero sign-in required for the demo",
              ].map((x) => (
                <li key={x} className="flex items-center gap-2">
                  <CheckCircle2 className="shrink-0 text-emerald-600" size={17} aria-hidden />
                  <span className="text-[#0f1b3a]">{x}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/tour"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-95"
              >
                <Sparkles size={16} className="text-white" /> Open Judge&apos;s 5-Min Tour <span className="font-mono">↗</span>
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded-xl border border-[#c8d2e8] bg-white px-5 py-3 text-sm font-semibold text-[#0f1b3a] shadow-2xs transition hover:bg-[#f6f8fd] active:scale-95"
              >
                How it works <ArrowRight size={15} aria-hidden />
              </a>
            </div>

            {/* REALISTIC Developer Git Workbench Preview */}
            <div className="mt-8 overflow-hidden rounded-2xl border border-[#dce3f1] bg-white shadow-xs">
              <div className="flex items-center justify-between border-b border-[#dce3f1] bg-[#f6f8fd] px-4 py-2.5 text-xs text-[#455272] font-mono">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-400 inline-block"></span>
                  <span className="h-3 w-3 rounded-full bg-amber-400 inline-block"></span>
                  <span className="h-3 w-3 rounded-full bg-emerald-400 inline-block"></span>
                  <span className="ml-2 font-semibold text-[#0f1b3a]">campuskart-core — git:main</span>
                </div>
                <span className="rounded-md bg-white px-2 py-0.5 font-bold text-[#1d3a9e] border border-[#b7c7f5] text-[11px]">
                  Pipeline
                </span>
              </div>
              <div className="p-4 font-mono text-xs text-[#d2dbee] space-y-2 bg-[#0f1b3a]">
                <div className="flex items-center gap-2 text-[#7b9bf0]">
                  <Terminal size={14} className="text-[#7b9bf0]" />
                  <span className="font-bold text-[#f3f6fc]">$ continuum connect --repo github.com/CampusKart/core --chat slack.zip</span>
                </div>
                <p className="text-emerald-400 pl-5">✓ Read 53 repo items, a 324-message chat export and 4 notes (CampusKart, synthetic)</p>
                <p className="text-[#a8b4d0] pl-5">✓ Masked before any AI saw it: keys, UPI ID, PAN, Aadhaar, phone (all fake)</p>
                <div className="mt-2 pt-2 border-t border-[#243566] pl-5">
                  <p className="font-semibold text-[#f3f6fc]">$ continuum verify --strict</p>
                  <p className="text-emerald-400">✓ 94 of 94 claims cite verbatim source quotes (rapidfuzz match: PASS)</p>
                  <p className="text-[#a8b4d0]">✓ Version frozen with a SHA-256 fingerprint: <span className="text-[#7b9bf0] font-bold">04e0ef3...</span></p>
                </div>
              </div>
              <div className="border-t border-[#dce3f1] bg-[#f6f8fd] p-3 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-[#455272]">
                  <GitCommit size={14} className="text-[#55627f]" /> Leaver: <b className="text-[#0f1b3a]">Aditi</b> ➔ Successor: <b className="text-[#0f1b3a]">Karan</b>
                </span>
                <span className="inline-flex items-center gap-1 text-[#1d3a9e] font-medium bg-[#e9efff] border border-[#b7c7f5] px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 size={12} className="text-[#2d54d6]" /> Every quote checked by code
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Demo Launcher Box */}
          <div className="rounded-3xl border border-[#dce3f1] bg-white p-6 shadow-xs lg:p-7">
            <div className="flex items-center justify-between border-b border-[#dce3f1] pb-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-[#0f1b3a]">Try the demo</h2>
                <p className="mt-0.5 text-xs text-[#455272]">
                  Project: <strong className="font-semibold text-[#0f1b3a]">CampusKart</strong> (synthetic Git data) · Aditi leaves, Karan takes over
                </p>
              </div>
              <span className="rounded-full border border-[#b7c7f5] bg-[#e9efff] px-2.5 py-1 text-xs font-semibold text-[#1d3a9e]">
                Live & Isolated
              </span>
            </div>

            <p className="mt-4 text-xs font-bold uppercase tracking-wider text-[#455272]">
              Pick a role to test (suggested order):
            </p>

            <div className="mt-3 space-y-3">
              {ORDER.map((r) => {
                const info = ROLE_INFO[r];
                return (
                  <button
                    key={r}
                    onClick={() => enter(r)}
                    disabled={busy !== null}
                    aria-busy={busy === r}
                    className="group flex w-full items-center gap-4 rounded-2xl border border-[#dce3f1] bg-white p-4 text-left shadow-2xs transition-all hover:border-[#7b9bf0] hover:bg-[#f6f8fd] active:scale-[0.99] disabled:cursor-wait disabled:opacity-80"
                  >
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#dce3f1] bg-[#f6f8fd] group-hover:scale-105 transition-transform">
                      {busy === r ? (
                        <Loader2 size={22} className="animate-spin text-[#0f1b3a]" aria-hidden />
                      ) : (
                        <UserAvatar
                          name={info.name}
                          role={r}
                          size={48}
                          className="rounded-xl border-0"
                        />
                      )}
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-[#55627f]">{info.step}</span>
                      <span className="block font-bold text-[#0f1b3a] sm:text-base">{info.title}</span>
                      <span className="block text-xs leading-snug text-[#455272] font-normal">{info.blurb}</span>
                    </span>
                    <ArrowRight className="shrink-0 text-[#55627f] transition group-hover:translate-x-1 group-hover:text-[#0f1b3a]" size={18} aria-hidden />
                  </button>
                );
              })}
            </div>

            {busy && (
              <div className="mt-4 rounded-xl border border-[#b7c7f5] bg-[#e9efff] p-3 text-xs text-[#1d3a9e]" role="status">
                <div className="flex items-center gap-2 font-semibold">
                  <Loader2 size={14} className="animate-spin text-[#2d54d6]" />
                  Preparing your private copy of the demo…
                </div>
                <p className="mt-1 text-[#2d54d6]">Nothing you do affects other visitors. This takes just a few seconds.</p>
              </div>
            )}
            {err && <p className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800" role="alert">{err}</p>}

            <div className="mt-4 flex items-center justify-between border-t border-[#dce3f1] pt-4">
              <button
                onClick={() => enter("guest")}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#455272] hover:text-[#0f1b3a] disabled:opacity-60"
              >
                <Globe2 size={15} aria-hidden /> Enter as Guest (Public claims only)
              </button>
              <Link href="/tour" className="text-xs font-semibold text-[#2d54d6] hover:text-[#0f1b3a] underline">
                Tour guide
              </Link>
            </div>
            <div className="mt-3 rounded-xl bg-[#f6f8fd] p-3 text-xs text-[#455272] ring-1 ring-[#dce3f1]">
              <span className="font-semibold text-[#0f1b3a]">3 demo projects:</span> CampusKart (Aditi to Karan), ClubSite (Neha to Arjun) and HackBot (Dev to Priya), each with its own team and planted problems.{" "}
              <button onClick={() => { setRole("lead"); router.push("/handovers"); }} className="font-semibold text-[#2d54d6] underline hover:text-[#0f1b3a]">Browse all projects</button>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-[#55627f]">
              Deterministic fallback enabled: finds all 8 planted facts in this demo even if external AI is unreachable.
            </p>
          </div>
        </div>
      </section>

      {/* Proof / Verified Metrics Bar */}
      <section className="rounded-2xl border border-[#dce3f1] bg-white p-6 shadow-2xs">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#dce3f1]">
          <div className="text-center px-4">
            <div className="text-3xl font-bold text-[#0f1b3a]">94 / 94</div>
            <div className="mt-1 text-xs font-bold uppercase tracking-wider text-[#455272]">Claims Cited</div>
            <p className="mt-0.5 text-xs text-[#55627f]">100% link to verbatim source text</p>
          </div>
          <div className="text-center px-4 pt-4 sm:pt-0">
            <div className="text-3xl font-bold text-emerald-700">8 of 8</div>
            <div className="mt-1 text-xs font-bold uppercase tracking-wider text-[#455272]">Planted Facts Found</div>
            <p className="mt-0.5 text-xs text-[#55627f]">Found with AI, and with no AI at all</p>
          </div>
          <div className="text-center px-4 pt-4 sm:pt-0">
            <div className="text-3xl font-bold text-[#0f1b3a]">0 leaks</div>
            <div className="mt-1 text-xs font-bold uppercase tracking-wider text-[#455272]">Sensitive Isolation</div>
            <p className="mt-0.5 text-xs text-[#55627f]">In every permission test: all endpoints, every role</p>
          </div>
          <div className="text-center px-4 pt-4 sm:pt-0">
            <div className="text-3xl font-bold text-[#0f1b3a] font-mono">SHA-256</div>
            <div className="mt-1 text-xs font-bold uppercase tracking-wider text-[#455272]">Signed & Frozen</div>
            <p className="mt-0.5 text-xs text-[#55627f]">Tamper-evident audit ledger</p>
          </div>
        </div>
      </section>

      {/* Examples Showcase */}
      <section aria-label="Examples from the demo">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#455272]">Honest Evidence States</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#0f1b3a] sm:text-3xl">What a handover looks like</h2>
          </div>
          <p className="text-xs text-[#55627f]">Every statement can be checked line-by-line.</p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Example
            Icon={BadgeCheck}
            state="Verified"
            cls="border-emerald-300 bg-emerald-50 text-emerald-950"
            text="Payments moved from a card gateway to UPI deep links in August because of merchant KYC."
            src="PR #87 · quote matched exactly"
          />
          <Example
            Icon={AlertTriangle}
            state="Conflicting"
            cls="border-rose-300 bg-rose-50 text-rose-950"
            text="README says Render, but commits since 2 Oct configure Vercel. Both shown side by side, not auto-resolved."
            src="README vs commits since 2 Oct"
          />
          <Example
            Icon={CircleHelp}
            state="Missing"
            cls="border-[#c8d2e8] border-dashed bg-[#f6f8fd] text-[#0f1b3a]"
            text="Who owns the college SMTP account? No source says. Routed automatically to the Gap Interview."
            src="Gap Interview question for leaver"
          />
        </div>
      </section>

      {/* Real Developer Pillars (Realistic Artifacts, NOT AI Artwork) */}
      <section>
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-bold uppercase tracking-wider text-[#455272]">Developer-Grade Design</span>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-[#0f1b3a] sm:text-4xl">
            Real code artifacts, every claim checked
          </h2>
          <p className="mt-2 text-sm text-[#455272]">
            A generic AI summary can state things nobody wrote. Continuum marks a statement Verified only when its quote is found in the source and a second check confirms it; everything else is labelled.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Pillar 1: Real GitHub PR & Citation */}
          <div className="rounded-2xl border border-[#dce3f1] bg-white shadow-2xs overflow-hidden flex flex-col hover:border-[#b7c7f5] transition-colors">
            <div className="border-b border-[#dce3f1] bg-[#f6f8fd] p-3 font-mono text-xs">
              <div className="flex items-center justify-between text-[#55627f] mb-1">
                <span className="flex items-center gap-1.5"><GitPullRequest size={13} className="text-[#2d54d6]" /> Pull Request #87</span>
                <span className="rounded bg-[#e9efff] text-[#1d3a9e] border border-[#b7c7f5] px-1.5 py-0.2 font-semibold">Merged</span>
              </div>
              <div className="font-bold text-[#0f1b3a]">feat(payments): UPI migration</div>
              <div className="mt-2 bg-[#0f1b3a] text-[#d2dbee] p-2 rounded text-[11px] font-mono leading-tight">
                <div className="text-rose-400">- const gateway = new RazorpayGateway();</div>
                <div className="text-emerald-400">+ const upi = new UpiDeepLinkGenerator();</div>
              </div>
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#55627f]">Truth & Traceability</span>
                <h3 className="text-base font-bold text-[#0f1b3a] mt-1">Claims, not fluffy summaries</h3>
                <p className="mt-2 text-xs leading-relaxed text-[#455272]">
                  Every handover statement is an atomic claim tied to verified repository lines, commit hashes, or issue comments.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#dce3f1] text-xs font-semibold text-emerald-800 flex items-center gap-1">
                <CheckCircle2 size={13} /> 94 of 94 Claims Citation-Verified
              </div>
            </div>
          </div>

          {/* Pillar 2: Real Gap Interview Q&A */}
          <div className="rounded-2xl border border-[#dce3f1] bg-white shadow-2xs overflow-hidden flex flex-col hover:border-[#b7c7f5] transition-colors">
            <div className="border-b border-[#dce3f1] bg-[#f6f8fd] p-3 font-mono text-xs">
              <div className="flex items-center justify-between text-[#55627f] mb-1">
                <span className="flex items-center gap-1.5"><FileText size={13} className="text-amber-600" /> Gap Interview #01</span>
                <span className="rounded bg-amber-100 text-amber-800 px-1.5 py-0.2 font-semibold">Answered</span>
              </div>
              <div className="font-bold text-[#0f1b3a]">Q: College SMTP Credentials?</div>
              <div className="mt-2 bg-[#f3f6fc] text-[#0f1b3a] p-2 rounded text-[11px] leading-tight border border-[#dce3f1]">
                <span className="font-semibold text-[#0f1b3a]">Aditi (Leaver):</span> &ldquo;Created by Prof. Sharma. Renewal is routed via Dean IT office.&rdquo;
              </div>
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#55627f]">Effort Reduction</span>
                <h3 className="text-base font-bold text-[#0f1b3a] mt-1">Targeted Gap Interview</h3>
                <p className="mt-2 text-xs leading-relaxed text-[#455272]">
                  Leavers don&apos;t waste hours writing stale wiki pages. Continuum asks ONLY what repository evidence cannot answer.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#dce3f1] text-xs font-semibold text-[#0f1b3a] flex items-center gap-1">
                <CheckCircle2 size={13} className="text-emerald-700" /> Asks only what the evidence cannot answer
              </div>
            </div>
          </div>

          {/* Pillar 3: Real Privacy & Secret Masking */}
          <div className="rounded-2xl border border-[#dce3f1] bg-white shadow-2xs overflow-hidden flex flex-col hover:border-[#b7c7f5] transition-colors">
            <div className="border-b border-[#dce3f1] bg-[#f6f8fd] p-3 font-mono text-xs">
              <div className="flex items-center justify-between text-[#55627f] mb-1">
                <span className="flex items-center gap-1.5"><Lock size={13} className="text-rose-600" /> Masking Engine</span>
                <span className="rounded bg-[#d2dbee] text-[#0f1b3a] px-1.5 py-0.2 font-semibold">Protected</span>
              </div>
              <div className="font-bold text-[#0f1b3a]">Config Ingest & Masking</div>
              <div className="mt-2 bg-[#0f1b3a] text-[#d2dbee] p-2 rounded text-[11px] font-mono leading-tight">
                <div>STRIPE_SECRET_KEY = <span className="bg-[#0d1735] text-[#7b9bf0] px-1 rounded">&ldquo;sk_test_••••••••&rdquo;</span></div>
                <div>MENTOR_PHONE = <span className="bg-[#0d1735] text-amber-300 px-1 rounded">&ldquo;+91-987••••••&rdquo;</span></div>
              </div>
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#55627f]">Zero-Leak Architecture</span>
                <h3 className="text-base font-bold text-[#0f1b3a] mt-1">Permission before generation</h3>
                <p className="mt-2 text-xs leading-relaxed text-[#455272]">
                  Lead-only architectural notes and credentials are automatically masked before any model or successor sees them.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#dce3f1] text-xs font-semibold text-[#0f1b3a] flex items-center gap-1">
                <CheckCircle2 size={13} className="text-emerald-700" /> Role-scoped access, enforced in the database
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Knowledge Continuity Loop Workbench (Soft Graphite & Lavender Haze Theme) */}
      <section className="rounded-3xl border border-[#243566] bg-[#0f1b3a] text-white p-8 sm:p-10 shadow-xs relative overflow-hidden">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#33406a] bg-[#0d1735] px-3.5 py-1 text-xs font-semibold text-[#7b9bf0]">
              <History size={13} /> Versioned handover loop <span className="font-mono">↖</span>
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              A handover is a living loop, <br className="hidden sm:inline" />
              not an abandoned PDF.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#d2dbee] max-w-lg">
              Knowledge transfer fails when the successor has no way to clarify ambiguities. Continuum lets the successor acknowledge sections or flag them as unclear. Flags automatically become follow-up tasks for the leaver, and version diffs track every iteration.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={() => enter("contributor")}
                className="inline-flex items-center gap-2.5 rounded-xl bg-[#7b9bf0] px-5 py-2.5 text-sm font-bold text-[#0a1330] shadow-xs transition hover:bg-[#9ab3f5] active:scale-95"
              >
                <UserAvatar name="Karan Verma" role="contributor" size={24} className="rounded-full" />
                <span>Experience Successor View</span>
                <ArrowRight size={15} />
              </button>
              <button
                onClick={() => enter("leaver")}
                className="inline-flex items-center gap-2.5 rounded-xl border border-[#33406a] bg-[#0d1735] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#22305a] active:scale-95"
              >
                <UserAvatar name="Aditi Rao" role="leaver" size={24} className="rounded-full" />
                <span>Try Gap Interview</span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#243566] bg-[#0a1330] p-4 font-mono text-xs text-[#d2dbee] space-y-3">
            <div className="flex items-center justify-between border-b border-[#243566] pb-2 text-[#8b98b8] text-[11px]">
              <span>git:campuskart/handover.diff</span>
              <span className="text-[#7b9bf0] font-bold">v1 ➔ v2 Diff</span>
            </div>
            <div className="space-y-1 text-[11px]">
              <div className="text-[#8b98b8]">## Section 5: External Dependencies</div>
              <div className="text-rose-400">- SMTP: college mail relay owner unknown [FLAGGED UNCLEAR BY KARAN]</div>
              <div className="text-emerald-400">+ SMTP: Prof. Sharma (CSE Dept) owns account, Dean IT handles renewal</div>
              <div className="text-[#a8b4d0] pl-2">↳ Exit Q&A ID: ev_qa_03 · Answered by @aditi · Confirmed by @lead</div>
            </div>
            <div className="pt-2 border-t border-[#243566] text-[#a8b4d0] text-[11px] flex justify-between">
              <span>Successor Karan: <b className="text-white">Acknowledged</b></span>
              <span className="font-bold text-[#7b9bf0]">Signed v2 (SHA: 04e0ef3)</span>
            </div>
          </div>
        </div>
      </section>

      {/* 5-Step Pipeline with Real Human & Code Roles */}
      <section id="how" className="scroll-mt-24">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <p className="text-xs font-bold uppercase tracking-wider text-[#455272]">Step-by-Step Developer Workflow</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#0f1b3a] sm:text-3xl">
            From Git repositories to a verified handover
          </h2>
          <p className="mt-2 text-sm text-[#455272]">Every step assigns clear roles and deterministic verification.</p>
        </div>

        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s) => (
            <li key={s.t} className="group relative rounded-2xl border border-[#dce3f1] bg-white p-5 shadow-2xs transition-all hover:border-[#7b9bf0] hover:shadow-xs">
              <div className="flex items-center justify-between">
                {s.avatarRole ? (
                  <UserAvatar
                    name={s.name}
                    role={s.avatarRole}
                    size={44}
                    className="rounded-xl border border-[#dce3f1] shadow-2xs"
                  />
                ) : s.systemIcon ? (
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0f1b3a] text-white shadow-2xs">
                    <s.systemIcon size={20} />
                  </div>
                ) : null}
                <span className="font-mono text-xs font-bold text-[#55627f]">{s.stepNum}</span>
              </div>
              <div className="mt-3 text-[11px] font-bold uppercase tracking-wider text-[#55627f]">{s.role}</div>
              <h3 className="mt-1 font-bold text-[#0f1b3a] text-base">{s.t}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[#455272]">{s.d}</p>
              <div className="mt-3 pt-2 border-t border-[#dce3f1] font-mono text-[10px] text-[#55627f]">
                {s.action}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Evidence States Guide */}
      <section>
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#455272]">Accessibility & Visual Standard</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#0f1b3a] sm:text-3xl">How to read the badges</h2>
          <p className="mt-1 text-sm text-[#455272]">Every claim carries one of five evidence states, shown as an icon plus text, never colour alone.</p>
        </div>
        <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          {STATES.map((s) => (
            <li key={s.n} className={`rounded-2xl border p-4 transition-transform hover:scale-[1.01] ${s.cls}`}>
              <div className="flex items-center gap-2 font-bold">
                <s.icon size={18} aria-hidden /> {s.n}
              </div>
              <p className="mt-2 text-xs leading-relaxed opacity-90">{s.d}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Trust badges */}
      <section aria-label="What Continuum guarantees">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Every claim cites a source", "Click a source chip to read the original text in context."],
            ["Nothing shown as verified without a check", "Inferred, conflicting and missing items are labelled, never hidden."],
            ["Secrets are masked before anyone reads", "Keys, UPI IDs, PAN and Aadhaar are masked at ingestion."],
            ["A human approves what is shared", "Review, edit, reject or redact before the successor sees it."],
          ].map(([t, d]) => (
            <li key={t} className="rounded-2xl border border-[#dce3f1] bg-white p-4 shadow-2xs">
              <p className="flex items-start gap-2 text-sm font-bold text-[#0f1b3a]"><BadgeCheck size={16} className="mt-0.5 shrink-0 text-[#2d54d6]" aria-hidden /> {t}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-[#455272]">{d}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq">
        <h2 id="faq" className="text-2xl font-bold tracking-tight text-[#0f1b3a] sm:text-3xl">Questions judges ask</h2>
        <div className="mt-4 space-y-2.5">
          {[
            ["Is this real data?", "No. CampusKart is a synthetic student project made for this demo. Each visitor gets their own copy, so nothing you do affects anyone else."],
            ["Do I need to sign in?", "No. Pick a role on this page and you get your own copy of the demo. To run your own private handovers, sign in with an email link: invited people then see only what their role allows, enforced by the database."],
            ["Can the AI make things up?", "It can be wrong, which is why every claim must cite a source, the quote is checked against it, and only a passing check can be called Verified. Anything else is labelled Inferred, Conflicting or Missing."],
            ["How is a successor kept from seeing confidential sources?", "A claim is visible only if the role may read all of its evidence. Hidden items are never sent to the browser; only a count is shown."],
            ["What are the limits?", "Built for small software teams (3 to 25 people). It reads a GitHub repo plus chat and notes exports today; live Slack sync is on the roadmap. The free server can take up to a minute to wake on the first visit."],
          ].map(([q, a]) => (
            <details key={q} className="group rounded-xl border border-[#dce3f1] bg-white p-4 shadow-2xs open:border-[#b7c7f5]">
              <summary className="cursor-pointer text-sm font-semibold text-[#0f1b3a]">{q}</summary>
              <p className="mt-2 text-sm leading-relaxed text-[#455272]">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="rounded-3xl border border-[#dce3f1] bg-[#e5eaf6] p-10 text-center text-[#0f1b3a] shadow-2xs">
        <div className="max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c8d2e8] bg-white px-3.5 py-1 text-xs font-semibold text-[#0f1b3a] shadow-2xs">
            <Sparkles size={13} className="text-[#2d54d6]" /> Ready to evaluate?
          </span>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl text-[#0f1b3a]">
            See a handover that shows its work
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#455272]">
            Open the demo as the reviewer, inspect source citations, check conflict resolutions, or take the 5-minute guided judge tour.
          </p>
          <div className="mt-6 flex flex-wrap justify-center items-center gap-3">
            <button
              onClick={() => enter("lead")}
              className="inline-flex items-center gap-2.5 rounded-xl bg-brand-600 px-7 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 active:scale-95"
            >
              <UserAvatar name="Lead Reviewer" role="lead" size={24} className="rounded-full border border-[#33406a]" />
              <span>Start as Reviewer</span>
              <ArrowRight size={16} className="text-white" aria-hidden />
            </button>
            <Link
              href="/tour"
              className="inline-flex items-center gap-2 rounded-xl border border-[#c8d2e8] bg-white px-6 py-3 text-sm font-semibold text-[#0f1b3a] shadow-2xs transition hover:bg-[#f6f8fd] active:scale-95"
            >
              Take Judge&apos;s Tour
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
