"use client";
import { useRouter } from "next/navigation";
import { ArrowRight, ClipboardCheck, Mic, UserRoundCheck } from "lucide-react";
import { ROLE_META, useSession } from "@/lib/session";
import type { Role } from "@/lib/types";
import { Card } from "@/components/ui";

const ICON = { lead: ClipboardCheck, contributor: UserRoundCheck, leaver: Mic };
const STEPS = [
  ["Connect", "Repo, chat export, notes, issues"],
  ["Reconstruct", "Extract claims that cite evidence"],
  ["Verify", "Check citations, flag conflicts and gaps"],
  ["Review", "Approve, edit, reject, redact"],
  ["Handover", "Successor sees only what they may see"],
];

export default function Landing() {
  const { setRole } = useSession();
  const router = useRouter();
  const enter = (r: Role) => {
    setRole(r);
    router.push(`/handovers`);
  };
  return (
    <div className="space-y-8">
      <section className="pt-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Project handovers that show their work.</h1>
        <p className="mt-3 max-w-3xl text-lg text-slate-700">
          When someone leaves, Continuum rebuilds the project&apos;s current state from its repo, chat, notes and task board. Every statement links to its source. Uncertainty is labelled, never hidden. A reviewer approves exactly what the successor may see.
        </p>
        <ol className="mt-5 grid gap-2 sm:grid-cols-5">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
              <span className="text-xs font-semibold text-indigo-700">Step {i + 1}</span>
              <div className="font-semibold">{t}</div>
              <div className="text-slate-600">{d}</div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="mb-1 text-xl font-semibold">Try the demo. No sign-in needed.</h2>
        <p className="mb-4 text-sm text-slate-600">
          A synthetic project, <strong>CampusKart</strong>, is already loaded. Aditi is leaving; Karan takes over. Pick a role. Suggested order: <strong>Reviewer</strong> (inspect and approve) → <strong>Leaver</strong> (answer questions) → <strong>Reviewer</strong> (publish) → <strong>Successor</strong>.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {(Object.keys(ROLE_META) as Role[]).map((r) => {
            const Icon = ICON[r];
            return (
              <Card key={r} className="flex flex-col">
                <Icon className="text-indigo-700" aria-hidden />
                <h3 className="mt-2 font-semibold">{ROLE_META[r].label}</h3>
                <p className="mt-1 flex-1 text-sm text-slate-600">{ROLE_META[r].blurb}</p>
                <button onClick={() => enter(r)} className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-md bg-indigo-700 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-800">
                  Enter as {ROLE_META[r].label} <ArrowRight size={15} aria-hidden />
                </button>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <h2 className="mb-2 font-semibold text-slate-900">How to read the badges</h2>
        <p>Every claim carries an evidence state: <b>Verified</b> (a source states it and a check confirmed it), <b>Inferred</b> (AI inference, not stated anywhere), <b>Conflicting</b> (sources disagree; never auto-resolved), <b>Missing</b> (needed but no evidence; becomes a leaver question), <b>Confirmed</b> (a human confirmed it).</p>
      </section>
    </div>
  );
}
