"use client";
// Demo session: one-click role entry, no sign-in (judges must be able to use the link unaided).
// Each visitor gets their OWN copy of the CampusKart demo handover (POST /demo/sandbox), remembered in this
// browser, so nobody sees anybody else's clicks.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Role } from "./types";
import { api, setApiRole } from "./api";

export const ROLE_META: Record<Role, { label: string; short: string; actor: string; blurb: string; home: (hid: string) => string }> = {
  lead: { label: "Reviewer (Lead)", short: "Reviewer", actor: "Reviewer (lead)", blurb: "Settles conflicts, reviews every claim and privacy item, answers the successor's questions and publishes versions. Sees everything.", home: (h) => `/handovers/${h}/ledger` },
  leaver: { label: "Leaver", short: "Leaver", actor: "Aditi (leaver)", blurb: "Answers only what the evidence cannot: Gap Interview questions and the successor's questions.", home: (h) => `/handovers/${h}/interview` },
  contributor: { label: "Successor (Contributor)", short: "Successor", actor: "Karan (successor)", blurb: "Reads the published handover, sees what changed, acknowledges sections or flags them as unclear.", home: (h) => `/handovers/${h}/start` },
  guest: { label: "Guest", short: "Guest", actor: "Guest viewer", blurb: "Read-only view of what is public (the open-source repo). Shows how much is hidden by access level.", home: (h) => `/handovers/${h}/start` },
};

const ROLE_KEY = "continuum-role";
const DEMO_KEY = "continuum-demo-hid";

interface Ctx {
  role: Role | null;
  ready: boolean;
  actor: string;
  setRole: (r: Role | null) => void;
  /** this browser's own demo handover id, if one was created */
  demoId: string | null;
  /** returns this browser's demo handover id, creating a fresh copy when needed (about 5-20 s on free hosting) */
  ensureDemo: () => Promise<string>;
  /** forget the current copy and make a new one */
  newDemo: () => Promise<string>;
}
const SessionCtx = createContext<Ctx>({
  role: null, ready: false, actor: "", setRole: () => {}, demoId: null,
  ensureDemo: async () => "h_1", newDemo: async () => "h_1",
});

const read = (k: string) => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v) window.localStorage.setItem(k, v);
    else window.localStorage.removeItem(k);
  } catch {}
};

let pending: Promise<string> | null = null;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(null);
  const [demoId, setDemoId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const r = read(ROLE_KEY) as Role | null;
    if (r && r in ROLE_META) {
      setRoleState(r);
      setApiRole(r);
    }
    setDemoId(read(DEMO_KEY));
    setReady(true);
  }, []);
  const setRole = (r: Role | null) => {
    setRoleState(r);
    setApiRole(r);
    write(ROLE_KEY, r);
  };
  const create = useCallback(async () => {
    const { handover_id } = await api.createSandbox();
    write(DEMO_KEY, handover_id);
    setDemoId(handover_id);
    return handover_id;
  }, []);
  const ensureDemo = useCallback(async () => {
    if (pending) return pending;
    pending = (async () => {
      const have = read(DEMO_KEY);
      if (have) {
        try {
          await api.getHandover(have);
          return have;
        } catch {
          /* expired or removed: make a new copy */
        }
      }
      return create();
    })().finally(() => {
      pending = null;
    });
    return pending;
  }, [create]);
  const newDemo = useCallback(async () => {
    write(DEMO_KEY, null);
    return create();
  }, [create]);
  return (
    <SessionCtx.Provider value={{ role, ready, actor: role ? ROLE_META[role].actor : "", setRole, demoId, ensureDemo, newDemo }}>
      {children}
    </SessionCtx.Provider>
  );
}

export const useSession = () => useContext(SessionCtx);
