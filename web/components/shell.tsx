"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell, BookOpen, Check, ChevronDown, Cog, GitMerge, Globe2, History, ListChecks, LogIn, Menu, MessageCircleQuestion,
  Mic, Plug, RotateCcw, ShieldAlert, ShieldCheck, Sparkles, Users, X, type LucideIcon,
} from "lucide-react";
import { LogoMark } from "./logo";
import { api } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { ROLE_META, SessionProvider, useSession } from "@/lib/session";
import type { Handover, NotificationItem, Role } from "@/lib/types";
import { EvidenceProvider } from "./evidence";
import { TourProvider, useTour } from "./tour";
import { ServerBanner } from "./feedback";
import { UserAvatar } from "./avatar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <EvidenceProvider>
        <TourProvider>
          <Frame>{children}</Frame>
        </TourProvider>
      </EvidenceProvider>
    </SessionProvider>
  );
}

/** The handover id in the current URL, if any (/handovers/{id}/...). */
function useHid(): string | null {
  const path = usePathname();
  const m = path?.match(/^\/handovers\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function Frame({ children }: { children: ReactNode }) {
  const hid = useHid();
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopBar hid={hid} />
      <ServerBanner />
      {hid ? (
        <Workspace hid={hid}>{children}</Workspace>
      ) : (
        <>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
          <SiteFooter />
        </>
      )}
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-ink-soft sm:px-6">
        <span className="font-semibold text-ink">Continuum · Team Binary Builders</span>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link href="/tour" className="hover:text-brand-700 hover:underline">Judge&apos;s tour</Link>
          <Link href="/verify" className="hover:text-brand-700 hover:underline">Verify an export</Link>
          <Link href="/signin" className="hover:text-brand-700 hover:underline">Sign in</Link>
        </nav>
      </div>
    </footer>
  );
}

/** Polls the role's to-do counts for the open handover (every 30 s). */
export function useNotifications(hid: string | null) {
  const { role } = useSession();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const load = useCallback(async () => {
    if (!hid || !role) return;
    try {
      setItems((await api.getNotifications(hid)).items);
    } catch {
      /* the bell never blocks the page */
    }
  }, [hid, role]);
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    const again = () => load();
    window.addEventListener("continuum:changed", again);
    return () => {
      clearInterval(t);
      window.removeEventListener("continuum:changed", again);
    };
  }, [load]);
  return items;
}

/** Tell the header bell and sidebar badges that something changed. */
export const notifyChanged = () => typeof window !== "undefined" && window.dispatchEvent(new Event("continuum:changed"));

function useClickAway(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open, close]);
  return ref;
}

// ---------------------------------------------------------------- top bar
function TopBar({ hid }: { hid: string | null }) {
  const { role } = useSession();
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setEmail(getSession()?.email ?? null);
    read();
    window.addEventListener("continuum:auth", read);
    return () => window.removeEventListener("continuum:auth", read);
  }, []);
  const link = "hidden rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-brand-50 hover:text-ink md:inline-flex";
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-2 px-3 sm:px-5">
        {hid && (
          <button aria-label="Open navigation" className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink hover:bg-brand-50 lg:hidden" onClick={() => window.dispatchEvent(new Event("continuum:menu"))}>
            <Menu size={20} aria-hidden />
          </button>
        )}
        <Link href="/" className="flex items-center gap-2 rounded-lg py-1 pr-2 font-bold text-ink" aria-label="Continuum home">
          <LogoMark size={30} /> <span className="text-[17px] tracking-tight">Continuum</span>
        </Link>
        <nav aria-label="Main" className="ml-3 flex items-center gap-0.5">
          <Link href="/handovers" className={link}>Projects</Link>
          <Link href="/tour" className={link}><Sparkles size={14} className="mr-1.5 text-brand-600" aria-hidden /> Judge&apos;s tour</Link>
          {!role && <Link href="/#how" className={link}>How it works</Link>}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          {role && hid && role !== "guest" && <NotificationBell hid={hid} />}
          {role ? (
            <AccountMenu hid={hid} email={email} />
          ) : (
            <>
              <Link href="/signin" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-brand-50 hover:text-ink sm:inline-flex">{email ?? "Sign in"}</Link>
              <Link href="/#demo" className="inline-flex items-center rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">Try the demo</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function NotificationBell({ hid }: { hid: string }) {
  const items = useNotifications(hid).filter((i) => i.count > 0);
  const total = items.reduce((n, i) => n + i.count, 0);
  const [open, setOpen] = useState(false);
  const ref = useClickAway(open, () => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button aria-label={`Things that need you: ${total}`} aria-expanded={open} onClick={() => setOpen(!open)} className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink hover:bg-brand-50">
        <Bell size={19} aria-hidden />
        {total > 0 && <span className="absolute right-1 top-1 min-w-[1.1rem] rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-[1.1rem] text-white">{total}</span>}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-line bg-white p-2 text-sm text-ink shadow-xl">
          <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">Needs your attention</p>
          {items.length === 0 && <p className="px-2 py-2 text-ink-soft">Nothing right now.</p>}
          {items.map((i) => (
            <Link role="menuitem" key={i.key} href={`/handovers/${hid}/${i.tab}`} onClick={() => setOpen(false)} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-brand-50">
              <span>{i.label}</span>
              <span className="rounded-full bg-brand-100 px-2 text-xs font-semibold text-brand-800">{i.count}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const ROLE_ORDER: Role[] = ["lead", "leaver", "contributor", "guest"];

function RoleAvatar({ role, size = 28 }: { role: Role; size?: number }) {
  if (role === "guest") {
    return <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-800" style={{ width: size, height: size }}><Globe2 size={size * 0.55} aria-hidden /></span>;
  }
  return <UserAvatar name={ROLE_META[role].actor} role={role} size={size} />;
}

/** One menu for everything about "who am I and what can I do here": role switch, tour, account, demo copy. */
function AccountMenu({ hid, email }: { hid: string | null; email: string | null }) {
  const { role, setRole, demoId, ensureDemo, newDemo } = useSession();
  const router = useRouter();
  const { open: openHelp } = useTour();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useClickAway(open, () => setOpen(false));
  if (!role) return null;
  const target = hid && (hid === demoId || hid.startsWith("h_demo_")) ? hid : demoId;
  const item = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink hover:bg-brand-50";
  async function switchTo(r: Role) {
    setBusy(true);
    setRole(r);
    try {
      const id = hid ?? (await ensureDemo());
      setOpen(false);
      router.push(ROLE_META[r].home(id));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="relative" ref={ref}>
      <button
        aria-label={`Role and account menu. Viewing as ${ROLE_META[role].short}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-10 items-center gap-2 rounded-lg border border-line bg-white pl-1.5 pr-2.5 text-sm font-semibold text-ink shadow-2xs hover:border-brand-300 hover:bg-brand-50"
      >
        <RoleAvatar role={role} size={26} />
        <span className="hidden sm:inline">{ROLE_META[role].short}</span>
        <ChevronDown size={15} className="text-ink-soft" aria-hidden />
      </button>
      {open && (
        <div role="menu" aria-label="Role and account" className="absolute right-0 z-50 mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-line bg-white p-2 shadow-xl">
          <p className="px-2.5 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">Viewing as</p>
          {ROLE_ORDER.map((r) => (
            <button key={r} role="menuitemradio" aria-checked={r === role} disabled={busy} className={item} onClick={() => switchTo(r)}>
              <RoleAvatar role={r} size={26} />
              <span className="flex-1"><span className="block font-semibold">{ROLE_META[r].label}</span></span>
              {r === role && <Check size={16} className="text-brand-600" aria-hidden />}
            </button>
          ))}
          <div className="my-1.5 border-t border-line" />
          <Link role="menuitem" href="/tour" className={item} onClick={() => setOpen(false)}><Sparkles size={16} className="text-brand-600" aria-hidden /> Judge&apos;s 5-minute tour</Link>
          <button role="menuitem" className={item} onClick={() => { setOpen(false); openHelp(); }}><BookOpen size={16} className="text-brand-600" aria-hidden /> Guided help</button>
          <Link role="menuitem" href="/verify" className={item} onClick={() => setOpen(false)}><ShieldCheck size={16} className="text-brand-600" aria-hidden /> Verify an export</Link>
          <Link role="menuitem" href="/signin" className={item} onClick={() => setOpen(false)}><LogIn size={16} className="text-brand-600" aria-hidden /> {email ? `Account: ${email}` : "Sign in (private handovers)"}</Link>
          {(target || demoId) && <div className="my-1.5 border-t border-line" />}
          {target && (
            <button
              role="menuitem"
              className={item}
              onClick={async () => {
                if (!window.confirm("Reset your copy of the demo to its starting point (v1 published)? Your review work in this copy will be lost.")) return;
                await api.resetDemo(target);
                window.location.reload();
              }}
            >
              <RotateCcw size={16} className="text-ink-soft" aria-hidden /> Reset my demo copy
            </button>
          )}
          {demoId && (
            <button
              role="menuitem"
              className={item}
              onClick={async () => {
                if (!window.confirm("Start a brand-new copy of the demo?")) return;
                setOpen(false);
                const id = await newDemo();
                router.push(`/handovers/${id}/${role === "leaver" ? "interview" : role === "contributor" || role === "guest" ? "start" : "ledger"}`);
              }}
            >
              <Sparkles size={16} className="text-ink-soft" aria-hidden /> New demo copy
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- workspace: sidebar + content
interface NavItem { seg: string; label: string; icon: LucideIcon; roles: Role[]; badge?: string[] }
const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Build", items: [
    { seg: "connect", label: "Connect sources", icon: Plug, roles: ["lead"] },
    { seg: "reconstruct", label: "Reconstruct", icon: Cog, roles: ["lead"] },
  ] },
  { group: "Review", items: [
    { seg: "ledger", label: "Claim ledger", icon: ListChecks, roles: ["lead"], badge: ["pending_claims"] },
    { seg: "conflicts", label: "Conflicts", icon: GitMerge, roles: ["lead"], badge: ["conflicts"] },
    { seg: "tasks", label: "Questions", icon: MessageCircleQuestion, roles: ["lead"], badge: ["answered_tasks"] },
    { seg: "privacy", label: "Privacy", icon: ShieldAlert, roles: ["lead"], badge: ["privacy"] },
  ] },
  { group: "Handover", items: [
    { seg: "interview", label: "Gap Interview", icon: Mic, roles: ["leaver", "lead"], badge: ["tasks", "gaps"] },
    { seg: "start", label: "Start here", icon: BookOpen, roles: ["contributor", "lead", "guest"], badge: ["to_ack"] },
    { seg: "activity", label: "Activity", icon: History, roles: ["lead"] },
    { seg: "people", label: "People", icon: Users, roles: ["lead"] },
  ] },
];

function useHandoverMeta(hid: string) {
  const [h, setH] = useState<Handover | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => api.getHandover(hid).then((x) => live && setH(x)).catch(() => {});
    load();
    window.addEventListener("continuum:changed", load);
    return () => {
      live = false;
      window.removeEventListener("continuum:changed", load);
    };
  }, [hid]);
  return h;
}

export const projectName = (h: Handover | null) => h?.title || (h?.is_demo ? "CampusKart" : h ? `${h.leaver}'s project` : "");

function SidebarContent({ hid }: { hid: string }) {
  const { role } = useSession();
  const path = usePathname();
  const h = useHandoverMeta(hid);
  const items = useNotifications(role && role !== "guest" ? hid : null);
  if (!role) return null;
  const count = (keys?: string[]) => (keys ?? []).reduce((n, k) => n + (items.find((i) => i.key === k)?.count ?? 0), 0);
  const status = !h ? null : h.version ? (h.status === "published" ? `Published v${h.version}` : `v${h.version} live · editing v${h.version + 1}`) : "Draft, not published";
  return (
    <nav aria-label="Handover steps" className="flex flex-col gap-5">
      <div className="rounded-xl border border-line bg-brand-50/70 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">Handover</p>
        <p className="mt-0.5 truncate text-[15px] font-bold text-ink">{projectName(h) || "…"}</p>
        {h && <p className="truncate text-sm capitalize text-ink-soft">{h.leaver} → {h.successor}</p>}
        {status && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-ink-soft ring-1 ring-line"><span className={`h-1.5 w-1.5 rounded-full ${h?.status === "published" ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden />{status}</p>}
      </div>
      {NAV.map((g) => {
        const vis = g.items.filter((i) => i.roles.includes(role));
        if (!vis.length) return null;
        return (
          <div key={g.group}>
            <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-[#55627f]">{g.group}</p>
            <ul className="space-y-0.5">
              {vis.map((t) => {
                const href = `/handovers/${hid}/${t.seg}`;
                const on = path === href;
                const n = count(t.badge);
                const Icon = t.icon;
                return (
                  <li key={t.seg}>
                    <Link href={href} aria-current={on ? "page" : undefined} className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${on ? "bg-brand-600 text-white shadow-sm" : "text-ink-soft hover:bg-brand-50 hover:text-ink"}`}>
                      <Icon size={17} className={on ? "text-white" : "text-brand-600"} aria-hidden />
                      <span className="flex-1">{t.label}</span>
                      {n > 0 && <span aria-label={`${n} need attention`} className={`min-w-[1.25rem] rounded-full px-1.5 text-center text-[11px] font-bold ${on ? "bg-white/25 text-white" : "bg-rose-100 text-rose-800"}`}>{n}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function Workspace({ hid, children }: { hid: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener("continuum:menu", on);
    return () => window.removeEventListener("continuum:menu", on);
  }, []);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1">
      <aside className="hidden w-64 shrink-0 border-r border-line bg-white lg:block">
        <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto p-4"><SidebarContent hid={hid} /></div>
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button aria-label="Close navigation" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[19rem] max-w-[85vw] overflow-y-auto bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-bold text-ink">Navigate</span>
              <button aria-label="Close navigation" className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-brand-50" onClick={() => setOpen(false)}><X size={20} aria-hidden /></button>
            </div>
            <SidebarContent hid={hid} />
          </div>
        </div>
      )}
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}

/** Kept so every screen can still render <HandoverNav/>; navigation now lives in the workspace sidebar. */
export function HandoverNav({ hid }: { hid: string }) {
  void hid;
  return null;
}

/** Redirects to role-appropriate screen if the current role may not open this page. */
export function RoleGuard({ hid, allow, children }: { hid: string; allow: Role[]; children: ReactNode }) {
  const { role, ready } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    if (!role) router.replace("/");
    else if (!allow.includes(role)) router.replace(ROLE_META[role].home(hid));
  }, [ready, role, allow, hid, router]);
  if (!ready || !role || !allow.includes(role)) return <p className="text-sm text-ink-soft">Checking your access…</p>;
  return <>{children}</>;
}
