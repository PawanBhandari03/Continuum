"use client";
// Demo session: one-click role entry, no sign-in (judges must be able to use the link unaided).
// Mock-first; Supabase Auth replaces this once keys are provided.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Role } from "./types";
import { setApiRole } from "./api";

export const ROLE_META: Record<Role, { label: string; actor: string; blurb: string; home: (hid: string) => string }> = {
  lead: { label: "Reviewer (Lead)", actor: "reviewer", blurb: "Connects sources, reviews every claim, approves and publishes. Sees everything.", home: (h) => `/handovers/${h}/ledger` },
  contributor: { label: "Successor (Contributor)", actor: "karan", blurb: "Receives the published handover. Sees only what the Contributor role may read.", home: (h) => `/handovers/${h}/start` },
  leaver: { label: "Leaver", actor: "aditi", blurb: "Answers the short Gap Interview where the evidence is missing or conflicting.", home: (h) => `/handovers/${h}/interview` },
};

interface Ctx {
  role: Role | null;
  ready: boolean;
  actor: string;
  setRole: (r: Role | null) => void;
}
const SessionCtx = createContext<Ctx>({ role: null, ready: false, actor: "", setRole: () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const r = window.localStorage.getItem("continuum-role") as Role | null;
      if (r && r in ROLE_META) {
        setRoleState(r);
        setApiRole(r);
      }
    } catch {}
    setReady(true);
  }, []);
  const setRole = (r: Role | null) => {
    setRoleState(r);
    setApiRole(r);
    try {
      if (r) window.localStorage.setItem("continuum-role", r);
      else window.localStorage.removeItem("continuum-role");
    } catch {}
  };
  return <SessionCtx.Provider value={{ role, ready, actor: role ? ROLE_META[role].actor : "", setRole }}>{children}</SessionCtx.Provider>;
}

export const useSession = () => useContext(SessionCtx);
