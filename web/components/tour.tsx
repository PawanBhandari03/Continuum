"use client";
// First-run guided tour for judges: a dismissible stepper that tells them what to do next and
// can take them to the right screen (switching role when needed). Non-modal, keyboard accessible.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CircleHelp, X } from "lucide-react";
import { useSession } from "@/lib/session";
import type { Role } from "@/lib/types";

interface Step {
  title: string;
  body: string;
  go?: { label: string; role: Role; href: string };
}

const H = "/handovers/h_1";
const STEPS: Step[] = [
  { title: "Pick a role", body: "Continuum has three roles. You are starting as the Reviewer (team lead), who checks and approves the handover. You can switch role at any time from the top bar.", go: { label: "Enter as Reviewer", role: "lead", href: "/handovers" } },
  { title: "Open the CampusKart handover", body: "CampusKart is a synthetic project. Aditi is leaving and Karan takes over. Open the handover to see the claim ledger: every statement is a claim with an evidence state.", go: { label: "Open the claim ledger", role: "lead", href: `${H}/ledger` } },
  { title: "Check a claim against its source", body: "Click any source chip (for example “PR #87”) under a claim. The original text opens with the cited quote highlighted. Try one Verified and one Inferred claim and compare their badges.", go: { label: "Show the ledger", role: "lead", href: `${H}/ledger` } },
  { title: "Resolve the conflict", body: "The README says Render, but later commits configure Vercel. Continuum never picks the newest. Choose a side and write a note, or mark it “unresolved — successor to follow up”.", go: { label: "Open Conflicts", role: "lead", href: `${H}/conflicts` } },
  { title: "Answer a Gap Interview question", body: "Switch to the Leaver. Continuum asks only what the evidence cannot answer, such as who owns the college SMTP account. Type a short answer and save it, or skip.", go: { label: "Go to the Gap Interview as Leaver", role: "leaver", href: `${H}/interview` } },
  { title: "Approve and publish", body: "Back as Reviewer: press “Approve all Verified claims”, then “Approve all remaining” (or approve claims one by one). Publish stays disabled, and says why, until conflicts are handled and every claim is reviewed.", go: { label: "Back to the ledger as Reviewer", role: "lead", href: `${H}/ledger` } },
  { title: "See what the Successor sees", body: "Switch to the Successor (Contributor). They see only claims whose evidence their role may read. Look for “items hidden by your access level”: a count, never the content.", go: { label: "Open Start here as Successor", role: "contributor", href: `${H}/start` } },
  { title: "Acknowledge or flag", body: "Under any section press “I have read this”, or “This is unclear” to send a flag back to the reviewer and leaver. That is the end of the handover loop. You can export the handover from this page.", go: { label: "Show Start here", role: "contributor", href: `${H}/start` } },
];

const SEEN = "continuum-tour-seen";
const POS = "continuum-tour-step";

interface Ctx {
  open: () => void;
}
const TourCtx = createContext<Ctx>({ open: () => {} });
export const useTour = () => useContext(TourCtx);

export function TourProvider({ children }: { children: ReactNode }) {
  const { setRole, ready } = useSession();
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
              onClick={() => {
                setRole(cur.go!.role);
                router.push(cur.go!.href);
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
    <button onClick={open} className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-100" aria-label="Open the guided tour">
      <CircleHelp size={15} aria-hidden /> Help
    </button>
  );
}
