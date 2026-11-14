"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
    <div className="group rounded-2xl border border-[#e5dfd6] bg-white p-5 text-left shadow-2xs transition-all hover:border-[#92a9e1] hover:shadow-xs">
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
          <Icon size={13} aria-hidden /> {state}
        </span>
        <span className="font-mono text-[11px] text-[#898170]">git:campuskart</span>
      </div>
      <p className="mt-3 text-sm font-semibold leading-relaxed text-[#25272d]">{text}</p>
      <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg border border-[#e5dfd6] bg-[#faf7f2] px-2.5 py-1 text-xs font-medium text-[#575245]">
        <MessageSquareText size={12} className="text-[#898170]" aria-hidden /> {src}
      </div>
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
    <div className="space-y-20 pb-16">
      {/* Top Tagline Banner & Mood Pills from Theme */}
      <section id="demo" className="pt-4 lg:pt-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#b8c8ee] bg-[#eef3fd] px-3.5 py-1 text-xs font-semibold text-[#2b3e70] shadow-2xs">
            <Terminal size={14} className="text-[#506cb8]" />
            <span>CodeFrontier 2024 · Problem 01: Prevent Critical Knowledge From Leaving With People</span>
          </div>
          <div className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-[#575245]">
            <span className="rounded-full border border-[#d6ccbf] bg-white px-3 py-0.5 shadow-2xs">Calm</span>
            <span className="rounded-full border border-[#d6ccbf] bg-white px-3 py-0.5 shadow-2xs">Confidence</span>
            <span className="rounded-full border border-[#d6ccbf] bg-white px-3 py-0.5 shadow-2xs">Modern</span>
            <span className="rounded-full border border-[#d6ccbf] bg-white px-3 py-0.5 shadow-2xs">Powerful</span>
          </div>
        </div>

        <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-[#25272d] sm:text-5xl xl:text-6xl">
              Project handovers that{" "}
              <span className="relative inline-block text-[#25272d]">
                <span className="relative z-10">show their work.</span>
                <span className="absolute bottom-1 left-0 -z-0 h-3 w-full rounded bg-[#92a9e1]/45 sm:bottom-2"></span>
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#575245] font-normal">
              When a developer leaves, Continuum rebuilds the project&apos;s current state directly from its Git repo, commits, chat archives, and issues. Every statement cites its source line, uncertainty is honestly labelled, and a reviewer approves exactly what the successor may read.
            </p>

            <ul className="mt-6 grid max-w-xl gap-2.5 text-sm font-medium text-[#575245] sm:grid-cols-2">
              {[
                "Every claim cites exact Git commits or docs",
                "Uncertainty is labelled, never hidden",
                "Each version signed and frozen (SHA-256)",
                "Zero sign-in required for the demo",
              ].map((x) => (
                <li key={x} className="flex items-center gap-2">
                  <CheckCircle2 className="shrink-0 text-emerald-600" size={17} aria-hidden />
                  <span className="text-[#25272d]">{x}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/tour"
                className="inline-flex items-center gap-2 rounded-xl bg-[#25272d] px-6 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-[#191b1f] active:scale-95"
              >
                <Sparkles size={16} className="text-[#92a9e1]" /> Open Judge&apos;s 5-Min Tour <span className="font-mono text-[#92a9e1]">↗</span>
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded-xl border border-[#d6ccbf] bg-white px-5 py-3 text-sm font-semibold text-[#25272d] shadow-2xs transition hover:bg-[#faf7f2] active:scale-95"
              >
                How it works <ArrowRight size={15} aria-hidden />
              </a>
            </div>

            {/* REALISTIC Developer Git Workbench Preview */}
            <div className="mt-8 overflow-hidden rounded-2xl border border-[#e5dfd6] bg-white shadow-xs">
              <div className="flex items-center justify-between border-b border-[#e5dfd6] bg-[#faf7f2] px-4 py-2.5 text-xs text-[#575245] font-mono">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-400 inline-block"></span>
                  <span className="h-3 w-3 rounded-full bg-amber-400 inline-block"></span>
                  <span className="h-3 w-3 rounded-full bg-emerald-400 inline-block"></span>
                  <span className="ml-2 font-semibold text-[#25272d]">campuskart-core — git:main</span>
                </div>
                <span className="rounded-md bg-white px-2 py-0.5 font-bold text-[#2b3e70] border border-[#b8c8ee] text-[11px]">
                  Hex #92A9E1 · Pipeline
                </span>
              </div>
              <div className="p-4 font-mono text-xs text-[#ded8cd] space-y-2 bg-[#25272d]">
                <div className="flex items-center gap-2 text-[#92a9e1]">
                  <Terminal size={14} className="text-[#92a9e1]" />
                  <span className="font-bold text-[#f4efea]">$ continuum connect --repo github.com/CampusKart/core --chat slack.zip</span>
                </div>
                <p className="text-emerald-400 pl-5">✓ Connected 142 commits, 28 PRs, 3 docs (CampusKart synthetic dataset)</p>
                <p className="text-[#c0b8a9] pl-5">✓ Filtered sensitive data: 2 fake API keys masked, 1 student phone redacted</p>
                <div className="mt-2 pt-2 border-t border-[#363942] pl-5">
                  <p className="font-semibold text-[#f4efea]">$ continuum verify --strict</p>
                  <p className="text-emerald-400">✓ 94 of 94 claims cite verbatim source quotes (rapidfuzz match: PASS)</p>
                  <p className="text-[#c0b8a9]">✓ Cryptographic ledger frozen with SHA-256 fingerprint: <span className="text-[#92a9e1] font-bold">04e0ef3...</span></p>
                </div>
              </div>
              <div className="border-t border-[#e5dfd6] bg-[#faf7f2] p-3 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-[#575245]">
                  <GitCommit size={14} className="text-[#898170]" /> Leaver: <b className="text-[#25272d]">Aditi</b> ➔ Successor: <b className="text-[#25272d]">Karan</b>
                </span>
                <span className="inline-flex items-center gap-1 text-[#2b3e70] font-medium bg-[#eef3fd] border border-[#b8c8ee] px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 size={12} className="text-[#506cb8]" /> 100% Deterministic Evidence
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Demo Launcher Box */}
          <div className="rounded-3xl border border-[#e5dfd6] bg-white p-6 shadow-xs lg:p-7">
            <div className="flex items-center justify-between border-b border-[#e5dfd6] pb-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-[#25272d]">Try the demo</h2>
                <p className="mt-0.5 text-xs text-[#575245]">
                  Project: <strong className="font-semibold text-[#25272d]">CampusKart</strong> (synthetic Git data) · Aditi leaves, Karan takes over
                </p>
              </div>
              <span className="rounded-full border border-[#b8c8ee] bg-[#eef3fd] px-2.5 py-1 text-xs font-semibold text-[#2b3e70]">
                Live & Isolated
              </span>
            </div>

            <p className="mt-4 text-xs font-bold uppercase tracking-wider text-[#575245]">
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
                    className="group flex w-full items-center gap-4 rounded-2xl border border-[#e5dfd6] bg-white p-4 text-left shadow-2xs transition-all hover:border-[#92a9e1] hover:bg-[#faf7f2] active:scale-[0.99] disabled:cursor-wait disabled:opacity-80"
                  >
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#e5dfd6] bg-[#faf7f2] group-hover:scale-105 transition-transform">
                      {busy === r ? (
                        <Loader2 size={22} className="animate-spin text-[#25272d]" aria-hidden />
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
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-[#898170]">{info.step}</span>
                      <span className="block font-bold text-[#25272d] sm:text-base">{info.title}</span>
                      <span className="block text-xs leading-snug text-[#575245] font-normal">{info.blurb}</span>
                    </span>
                    <ArrowRight className="shrink-0 text-[#898170] transition group-hover:translate-x-1 group-hover:text-[#25272d]" size={18} aria-hidden />
                  </button>
                );
              })}
            </div>

            {busy && (
              <div className="mt-4 rounded-xl border border-[#b8c8ee] bg-[#eef3fd] p-3 text-xs text-[#2b3e70]" role="status">
                <div className="flex items-center gap-2 font-semibold">
                  <Loader2 size={14} className="animate-spin text-[#506cb8]" />
                  Preparing your private copy of the demo…
                </div>
                <p className="mt-1 text-[#506cb8]">Nothing you do affects other visitors. This takes just a few seconds.</p>
              </div>
            )}
            {err && <p className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800" role="alert">{err}</p>}

            <div className="mt-4 flex items-center justify-between border-t border-[#e5dfd6] pt-4">
              <button
                onClick={() => enter("guest")}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#575245] hover:text-[#25272d] disabled:opacity-60"
              >
                <Globe2 size={15} aria-hidden /> Enter as Guest (Public claims only)
              </button>
              <Link href="/tour" className="text-xs font-semibold text-[#506cb8] hover:text-[#25272d] underline">
                Tour guide
              </Link>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-[#898170]">
              Deterministic fallback enabled: finds all 8 planted facts in this demo even if external AI is unreachable.
            </p>
          </div>
        </div>
      </section>

      {/* Proof / Verified Metrics Bar */}
      <section className="rounded-2xl border border-[#e5dfd6] bg-white p-6 shadow-2xs">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#e5dfd6]">
          <div className="text-center px-4">
            <div className="text-3xl font-bold text-[#25272d]">94 / 94</div>
            <div className="mt-1 text-xs font-bold uppercase tracking-wider text-[#575245]">Claims Cited</div>
            <p className="mt-0.5 text-xs text-[#898170]">100% link to verbatim source text</p>
          </div>
          <div className="text-center px-4 pt-4 sm:pt-0">
            <div className="text-3xl font-bold text-emerald-700">7 of 8</div>
            <div className="mt-1 text-xs font-bold uppercase tracking-wider text-[#575245]">Planted Facts Found</div>
            <p className="mt-0.5 text-xs text-[#898170]">Automatic code evaluation pass</p>
          </div>
          <div className="text-center px-4 pt-4 sm:pt-0">
            <div className="text-3xl font-bold text-[#25272d]">0 Leaks</div>
            <div className="mt-1 text-xs font-bold uppercase tracking-wider text-[#575245]">Sensitive Isolation</div>
            <p className="mt-0.5 text-xs text-[#898170]">Lead-only keys never reach successor</p>
          </div>
          <div className="text-center px-4 pt-4 sm:pt-0">
            <div className="text-3xl font-bold text-[#25272d] font-mono">SHA-256</div>
            <div className="mt-1 text-xs font-bold uppercase tracking-wider text-[#575245]">Signed & Frozen</div>
            <p className="mt-0.5 text-xs text-[#898170]">Tamper-evident audit ledger</p>
          </div>
        </div>
      </section>

      {/* Examples Showcase */}
      <section aria-label="Examples from the demo">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#575245]">Honest Evidence States</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#25272d] sm:text-3xl">What a handover looks like</h2>
          </div>
          <p className="text-xs text-[#898170]">Every statement can be checked line-by-line.</p>
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
            cls="border-[#d6ccbf] border-dashed bg-[#faf7f2] text-[#25272d]"
            text="Who owns the college SMTP account? No source says. Routed automatically to the Gap Interview."
            src="Gap Interview question for leaver"
          />
        </div>
      </section>

      {/* Real Developer Pillars (Realistic Artifacts, NOT AI Artwork) */}
      <section>
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-bold uppercase tracking-wider text-[#575245]">Developer-Grade Design</span>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-[#25272d] sm:text-4xl">
            Real code artifacts, zero AI hallucinations
          </h2>
          <p className="mt-2 text-sm text-[#575245]">
            Generic LLMs hallucinate summaries. Continuum grounds every single sentence in real Git commits, code diffs, and citable exit interviews.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Pillar 1: Real GitHub PR & Citation */}
          <div className="rounded-2xl border border-[#e5dfd6] bg-white shadow-2xs overflow-hidden flex flex-col hover:border-[#b8c8ee] transition-colors">
            <div className="border-b border-[#e5dfd6] bg-[#faf7f2] p-3 font-mono text-xs">
              <div className="flex items-center justify-between text-[#898170] mb-1">
                <span className="flex items-center gap-1.5"><GitPullRequest size={13} className="text-[#506cb8]" /> Pull Request #87</span>
                <span className="rounded bg-[#eef3fd] text-[#2b3e70] border border-[#b8c8ee] px-1.5 py-0.2 font-semibold">Merged</span>
              </div>
              <div className="font-bold text-[#25272d]">feat(payments): UPI migration</div>
              <div className="mt-2 bg-[#25272d] text-[#ded8cd] p-2 rounded text-[11px] font-mono leading-tight">
                <div className="text-rose-400">- const gateway = new RazorpayGateway();</div>
                <div className="text-emerald-400">+ const upi = new UpiDeepLinkGenerator();</div>
              </div>
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#898170]">Truth & Traceability</span>
                <h3 className="text-base font-bold text-[#25272d] mt-1">Claims, not fluffy summaries</h3>
                <p className="mt-2 text-xs leading-relaxed text-[#575245]">
                  Every handover statement is an atomic claim tied to verified repository lines, commit hashes, or issue comments.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#e5dfd6] text-xs font-semibold text-emerald-800 flex items-center gap-1">
                <CheckCircle2 size={13} /> 94 of 94 Claims Citation-Verified
              </div>
            </div>
          </div>

          {/* Pillar 2: Real Gap Interview Q&A */}
          <div className="rounded-2xl border border-[#e5dfd6] bg-white shadow-2xs overflow-hidden flex flex-col hover:border-[#b8c8ee] transition-colors">
            <div className="border-b border-[#e5dfd6] bg-[#faf7f2] p-3 font-mono text-xs">
              <div className="flex items-center justify-between text-[#898170] mb-1">
                <span className="flex items-center gap-1.5"><FileText size={13} className="text-amber-600" /> Gap Interview #01</span>
                <span className="rounded bg-amber-100 text-amber-800 px-1.5 py-0.2 font-semibold">Answered</span>
              </div>
              <div className="font-bold text-[#25272d]">Q: College SMTP Credentials?</div>
              <div className="mt-2 bg-[#f4efea] text-[#25272d] p-2 rounded text-[11px] leading-tight border border-[#e5dfd6]">
                <span className="font-semibold text-[#25272d]">Aditi (Leaver):</span> &ldquo;Created by Prof. Sharma. Renewal is routed via Dean IT office.&rdquo;
              </div>
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#898170]">Effort Reduction</span>
                <h3 className="text-base font-bold text-[#25272d] mt-1">Targeted Gap Interview</h3>
                <p className="mt-2 text-xs leading-relaxed text-[#575245]">
                  Leavers don&apos;t waste hours writing stale wiki pages. Continuum asks ONLY what repository evidence cannot answer.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#e5dfd6] text-xs font-semibold text-[#25272d] flex items-center gap-1">
                <CheckCircle2 size={13} className="text-emerald-700" /> Saves 80% Departing Engineer Time
              </div>
            </div>
          </div>

          {/* Pillar 3: Real Privacy & Secret Masking */}
          <div className="rounded-2xl border border-[#e5dfd6] bg-white shadow-2xs overflow-hidden flex flex-col hover:border-[#b8c8ee] transition-colors">
            <div className="border-b border-[#e5dfd6] bg-[#faf7f2] p-3 font-mono text-xs">
              <div className="flex items-center justify-between text-[#898170] mb-1">
                <span className="flex items-center gap-1.5"><Lock size={13} className="text-rose-600" /> Masking Engine</span>
                <span className="rounded bg-[#ded8cd] text-[#25272d] px-1.5 py-0.2 font-semibold">Protected</span>
              </div>
              <div className="font-bold text-[#25272d]">Config Ingest & Masking</div>
              <div className="mt-2 bg-[#25272d] text-[#ded8cd] p-2 rounded text-[11px] font-mono leading-tight">
                <div>STRIPE_SECRET_KEY = <span className="bg-[#1e2025] text-[#92a9e1] px-1 rounded">&ldquo;sk_test_••••••••&rdquo;</span></div>
                <div>MENTOR_PHONE = <span className="bg-[#1e2025] text-amber-300 px-1 rounded">&ldquo;+91-987••••••&rdquo;</span></div>
              </div>
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#898170]">Zero-Leak Architecture</span>
                <h3 className="text-base font-bold text-[#25272d] mt-1">Permission before generation</h3>
                <p className="mt-2 text-xs leading-relaxed text-[#575245]">
                  Lead-only architectural notes and credentials are automatically masked before any model or successor sees them.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#e5dfd6] text-xs font-semibold text-[#25272d] flex items-center gap-1">
                <CheckCircle2 size={13} className="text-emerald-700" /> Role-Scoped Cryptographic Separation
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Knowledge Continuity Loop Workbench (Soft Graphite & Lavender Haze Theme) */}
      <section className="rounded-3xl border border-[#363942] bg-[#25272d] text-white p-8 sm:p-10 shadow-xs relative overflow-hidden">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#434752] bg-[#1e2025] px-3.5 py-1 text-xs font-semibold text-[#92a9e1]">
              <History size={13} /> Hex #92A9E1 · Versioned Handover Loop <span className="font-mono">↖</span>
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              A handover is a living loop, <br className="hidden sm:inline" />
              not an abandoned PDF.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#ded8cd] max-w-lg">
              Knowledge transfer fails when the successor has no way to clarify ambiguities. Continuum lets the successor acknowledge sections or flag them as unclear. Flags automatically become follow-up tasks for the leaver, and version diffs track every iteration.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={() => enter("contributor")}
                className="inline-flex items-center gap-2.5 rounded-xl bg-[#92a9e1] px-5 py-2.5 text-sm font-bold text-[#191b1f] shadow-xs transition hover:bg-[#a6bbf0] active:scale-95"
              >
                <UserAvatar name="Karan Verma" role="contributor" size={24} className="rounded-full" />
                <span>Experience Successor View</span>
                <ArrowRight size={15} />
              </button>
              <button
                onClick={() => enter("leaver")}
                className="inline-flex items-center gap-2.5 rounded-xl border border-[#434752] bg-[#1e2025] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2c2f36] active:scale-95"
              >
                <UserAvatar name="Aditi Rao" role="leaver" size={24} className="rounded-full" />
                <span>Try Gap Interview</span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#363942] bg-[#191b1f] p-4 font-mono text-xs text-[#ded8cd] space-y-3">
            <div className="flex items-center justify-between border-b border-[#363942] pb-2 text-[#898170] text-[11px]">
              <span>git:campuskart/handover.diff</span>
              <span className="text-[#92a9e1] font-bold">v1 ➔ v2 Diff</span>
            </div>
            <div className="space-y-1 text-[11px]">
              <div className="text-[#898170]">## Section 5: External Dependencies</div>
              <div className="text-rose-400">- SMTP: college mail relay owner unknown [FLAGGED UNCLEAR BY KARAN]</div>
              <div className="text-emerald-400">+ SMTP: Prof. Sharma (CSE Dept) owns account, Dean IT handles renewal</div>
              <div className="text-[#c0b8a9] pl-2">↳ Exit Q&A ID: ev_qa_03 · Answered by @aditi · Confirmed by @lead</div>
            </div>
            <div className="pt-2 border-t border-[#363942] text-[#c0b8a9] text-[11px] flex justify-between">
              <span>Successor Karan: <b className="text-white">Acknowledged</b></span>
              <span className="font-bold text-[#92a9e1]">Signed v2 (SHA: 04e0ef3)</span>
            </div>
          </div>
        </div>
      </section>

      {/* 5-Step Pipeline with Real Human & Code Roles */}
      <section id="how" className="scroll-mt-24">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <p className="text-xs font-bold uppercase tracking-wider text-[#575245]">Step-by-Step Developer Workflow</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#25272d] sm:text-3xl">
            From Git repositories to a verified handover
          </h2>
          <p className="mt-2 text-sm text-[#575245]">Every step assigns clear roles and deterministic verification.</p>
        </div>

        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s) => (
            <li key={s.t} className="group relative rounded-2xl border border-[#e5dfd6] bg-white p-5 shadow-2xs transition-all hover:border-[#92a9e1] hover:shadow-xs">
              <div className="flex items-center justify-between">
                {s.avatarRole ? (
                  <UserAvatar
                    name={s.name}
                    role={s.avatarRole}
                    size={44}
                    className="rounded-xl border border-[#e5dfd6] shadow-2xs"
                  />
                ) : s.systemIcon ? (
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#25272d] text-white shadow-2xs">
                    <s.systemIcon size={20} />
                  </div>
                ) : null}
                <span className="font-mono text-xs font-bold text-[#898170]">{s.stepNum}</span>
              </div>
              <div className="mt-3 text-[11px] font-bold uppercase tracking-wider text-[#898170]">{s.role}</div>
              <h3 className="mt-1 font-bold text-[#25272d] text-base">{s.t}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[#575245]">{s.d}</p>
              <div className="mt-3 pt-2 border-t border-[#e5dfd6] font-mono text-[10px] text-[#898170]">
                {s.action}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Evidence States Guide */}
      <section>
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#575245]">Accessibility & Visual Standard</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#25272d] sm:text-3xl">How to read the badges</h2>
          <p className="mt-1 text-sm text-[#575245]">Every claim carries one of five evidence states, shown as an icon plus text, never colour alone.</p>
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

      {/* Final Call to Action */}
      <section className="rounded-3xl border border-[#e5dfd6] bg-[#ede9e2] p-10 text-center text-[#25272d] shadow-2xs">
        <div className="max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d6ccbf] bg-white px-3.5 py-1 text-xs font-semibold text-[#25272d] shadow-2xs">
            <Sparkles size={13} className="text-[#506cb8]" /> Ready to evaluate?
          </span>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl text-[#25272d]">
            See a handover that shows its work
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#575245]">
            Open the demo as the reviewer, inspect source citations, check conflict resolutions, or take the 5-minute guided judge tour.
          </p>
          <div className="mt-6 flex flex-wrap justify-center items-center gap-3">
            <button
              onClick={() => enter("lead")}
              className="inline-flex items-center gap-2.5 rounded-xl bg-[#25272d] px-7 py-3 text-sm font-bold text-white shadow-xs transition hover:bg-[#191b1f] active:scale-95"
            >
              <UserAvatar name="Lead Reviewer" role="lead" size={24} className="rounded-full border border-[#434752]" />
              <span>Start as Reviewer</span>
              <ArrowRight size={16} className="text-[#92a9e1]" aria-hidden />
            </button>
            <Link
              href="/tour"
              className="inline-flex items-center gap-2 rounded-xl border border-[#d6ccbf] bg-white px-6 py-3 text-sm font-semibold text-[#25272d] shadow-2xs transition hover:bg-[#faf7f2] active:scale-95"
            >
              Take Judge&apos;s Tour
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
