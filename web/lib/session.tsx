"use client";
// Demo session: one-click role entry, no sign-in (judges must be able to use the link unaided).
// Each visitor gets their OWN copy of each demo project (POST /demo/sandbox?project=...), remembered in this browser,
// so nobody sees anybody else's clicks.
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
const DEMO_KEY = "continuum-demo-hid"; // the demo copy opened most recently
const MAP_KEY = "continuum-demo-map"; // project key -> this browser's copy
const PROJECT_KEY = "continuum-demo-project";
export const DEFAULT_PROJECT = "campuskart";

interface Ctx {
  role: Role | null;
  ready: boolean;
  actor: string;
  setRole: (r: Role | null) => void;
  /** the demo copy opened most recently in this browser */
  demoId: string | null;
  /** this browser's copy per project (project key -> handover id) */
  demoMap: Record<string, string>;
  /** returns this browser's copy of a project, creating a fresh one when needed (about 5-20 s on free hosting) */
  ensureDemo: (project?: string) => Promise<string>;
  /** forget the copy of a project (default: the current one) and make a new one */
  newDemo: (project?: string) => Promise<string>;
}
const SessionCtx = createContext<Ctx>({
  role: null, ready: false, actor: "", setRole: () => {}, demoId: null, demoMap: {},
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
const readMap = (): Record<string, string> => {
  try {
    return JSON.parse(read(MAP_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
};

const pending: Record<string, Promise<string>> = {};

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(null);
  const [demoId, setDemoId] = useState<string | null>(null);
  const [demoMap, setDemoMap] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const r = read(ROLE_KEY) as Role | null;
    if (r && r in ROLE_META) {
      setRoleState(r);
      setApiRole(r);
    }
    const map = readMap();
    const cur = read(DEMO_KEY);
    if (cur && !Object.values(map).includes(cur)) map[read(PROJECT_KEY) ?? DEFAULT_PROJECT] = cur; // older single-copy sessions
    setDemoMap(map);
    setDemoId(cur);
    setReady(true);
  }, []);
  const setRole = (r: Role | null) => {
    setRoleState(r);
    setApiRole(r);
    write(ROLE_KEY, r);
  };
  const remember = useCallback((project: string, id: string) => {
    const map = { ...readMap(), [project]: id };
    write(MAP_KEY, JSON.stringify(map));
    write(DEMO_KEY, id);
    write(PROJECT_KEY, project);
    setDemoMap(map);
    setDemoId(id);
  }, []);
  const create = useCallback(async (project: string) => {
    const { handover_id } = await api.createSandbox(project);
    remember(project, handover_id);
    return handover_id;
  }, [remember]);
  const ensureDemo = useCallback(async (project: string = DEFAULT_PROJECT) => {
    const inflight: Promise<string> | undefined = pending[project];
    if (inflight) return inflight;
    pending[project] = (async () => {
      const have = readMap()[project] ?? (project === DEFAULT_PROJECT ? read(DEMO_KEY) : null);
      if (have) {
        try {
          await api.getHandover(have);
          remember(project, have);
          return have;
        } catch {
          /* expired or removed: make a new copy */
        }
      }
      return create(project);
    })().finally(() => {
      delete pending[project];
    });
    return pending[project];
  }, [create, remember]);
  const newDemo = useCallback(async (project?: string) => {
    const p = project ?? read(PROJECT_KEY) ?? DEFAULT_PROJECT;
    const map = readMap();
    delete map[p];
    write(MAP_KEY, JSON.stringify(map));
    return create(p);
  }, [create]);
  return (
    <SessionCtx.Provider value={{ role, ready, actor: role ? ROLE_META[role].actor : "", setRole, demoId, demoMap, ensureDemo, newDemo }}>
      {children}
    </SessionCtx.Provider>
  );
}

export const useSession = () => useContext(SessionCtx);
