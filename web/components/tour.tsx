"use client";
// First-run guided tour for judges: a dismissible stepper that tells them what to do next and
// can take them to the right screen (switching role when needed). Non-modal, keyboard accessible.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CircleHelp, X } from "lucide-react";
import { useSession } from "@/lib/session";
import type { Role } from "@/lib/types";

export interface Step {
  title: string;
  body: string;
  go?: { label: string; role: Role; path: string };
}

// The judge path: about 5 minutes, each step switches role and opens the right screen of YOUR demo copy.
const STEPS: Step[] = [
  { title: "Your own copy of the demo", body: "CampusKart is a synthetic student project: Aditi is leaving and Karan takes over. You get your own copy, already at a published v1, so nothing you do affects anyone else. Every statement is a claim with an evidence state and a source.", go: { label: "Open the claim ledger as Reviewer", role: "lead", path: "ledger" } },
  { title: "Settle a disagreement", body: "The README says Render, but later commits configure Vercel. Continuum shows both sides with dates and never assumes the newest is right. Keep one side and write who confirmed it. The decision is kept in the history.", go: { label: "Open Conflicts", role: "lead", path: "conflicts" } },
  { title: "Check what was masked", body: "Before any AI or successor saw the sources, Continuum masked keys, UPI IDs, PAN and Aadhaar numbers. A remark judging a teammate waits for your decision and blocks publishing until you make it.", go: { label: "Open Privacy", role: "lead", path: "privacy" } },
  { title: "Use the successor's question", body: "Karan flagged a section as unclear and Aditi already answered. Attach her answer to a claim (or make a new claim from it), then publish v2 from the ledger.", go: { label: "Open Questions", role: "lead", path: "tasks" } },
  { title: "See exactly what changed", body: "As the Successor, open the latest version: a panel shows what changed since you last read, and only changed sections ask to be acknowledged again. Flag anything that is still unclear; it goes to the leaver and the reviewer.", go: { label: "Open Start here as Successor", role: "contributor", path: "start" } },
  { title: "Answer as the leaver", body: "The leaver answers only what the evidence cannot: Gap Interview questions and the successor's questions. Answers become citable evidence. Keys and passwords are refused.", go: { label: "Open the Gap Interview as Leaver", role: "leaver", path: "interview" } },
  { title: "Prove nothing was tampered with", body: "As Reviewer, open Activity: every decision, view and export is logged, each entry fingerprinted with the previous one. Press “Verify integrity”. You can also enter as Guest from the home page to see the public-only view.", go: { label: "Open Activity as Reviewer", role: "lead", path: "activity" } },
];

/** The judge path, shared by this pop-up and the /tour page. */
export const JUDGE_STEPS = STEPS;

const SEEN = "continuum-tour-seen";
const POS = "continuum-tour-step";

interface Ctx {
  open: () => void;
}
const TourCtx = createContext<Ctx>({ open: () => {} });
export const useTour = () => useContext(TourCtx);

export function TourProvider({ children }: { children: ReactNode }) {
  const { setRole, ready, ensureDemo } = useSession();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!ready) return;
    try {
      const s = Number(window.localStorage.getItem(POS));
      if (Number.isInteger(s) && s >= 0 && s < STEPS.length) setStep(s);
      if (!window.localStorage.getItem(SEEN)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, [ready]);

  const remember = (s: number) => {
    try {
      window.localStorage.setItem(POS, String(s));
    } catch {}
  };
  const close = useCallback(() => {
    setVisible(false);
    try {
      window.localStorage.setItem(SEEN, "1");
    } catch {}
  }, []);
  const open = useCallback(() => setVisible(true), []);
  const goStep = (s: number) => {
    setStep(s);
    remember(s);
  };

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[aria-modal="true"]')) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, close]);

  const cur = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <TourCtx.Provider value={{ open }}>
      {children}
      {visible && (
        <aside role="region" aria-label="Guided tour" className="fixed inset-x-2 bottom-2 z-40 rounded-lg border border-indigo-300 bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700" aria-live="polite">Guided tour · Step {step + 1} of {STEPS.length}</p>
            <button onClick={close} aria-label="Close the guided tour" className="-mr-1 -mt-1 rounded p-1 text-slate-500 hover:bg-slate-100"><X size={16} /></button>
          </div>
          <h2 ref={headingRef} tabIndex={-1} className="mt-1 text-base font-semibold text-slate-900">{cur.title}</h2>
          <p className="mt-1 text-sm text-slate-700">{cur.body}</p>
          {cur.go && (
            <button
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-indigo-700 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-800"
              onClick={async () => {
                setRole(cur.go!.role);
                const hid = await ensureDemo();
                router.push(`/handovers/${hid}/${cur.go!.path}`);
              }}
            >
              {cur.go.label} <ArrowRight size={14} aria-hidden />
            </button>
          )}
          <div className="mt-3 flex items-center justify-between">
            <button className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-40" disabled={step === 0} onClick={() => goStep(step - 1)}><ArrowLeft size={14} aria-hidden /> Back</button>
            <ol className="flex gap-1" aria-hidden>
              {STEPS.map((_, i) => <li key={i} className={`h-1.5 w-1.5 rounded-full ${i === step ? "bg-indigo-700" : "bg-slate-300"}`} />)}
            </ol>
            {last ? (
              <button className="rounded px-2 py-1 text-sm font-medium text-indigo-800 hover:bg-indigo-50" onClick={() => { goStep(0); close(); }}>Finish</button>
            ) : (
              <button className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm font-medium text-indigo-800 hover:bg-indigo-50" onClick={() => goStep(step + 1)}>Next <ArrowRight size={14} aria-hidden /></button>
            )}
          </div>
        </aside>
      )}
    </TourCtx.Provider>
  );
}

export function HelpButton() {
  const { open } = useTour();
  return (
    <button onClick={open} className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-current hover:bg-slate-500/15" aria-label="Help: open the guided tour">
      <CircleHelp size={15} aria-hidden /> Help
    </button>
  );
}
