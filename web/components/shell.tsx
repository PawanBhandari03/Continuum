"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, RotateCcw } from "lucide-react";
import { LogoMark } from "./logo";
import { api } from "@/lib/api";
import { ROLE_META, SessionProvider, useSession } from "@/lib/session";
import type { NotificationItem, Role } from "@/lib/types";
import { EvidenceProvider } from "./evidence";
import { HelpButton, TourProvider } from "./tour";
import { ServerBanner } from "./feedback";

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
  const { demoId, newDemo } = useSession();
  const hid = useHid();
  const router = useRouter();
  const target = hid && (hid === demoId || hid.startsWith("h_demo_") || hid === "h_1") ? hid : demoId;
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <ServerBanner />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-slate-500">
          <span>Continuum · Team Binary Builders</span>
          <span className="flex items-center gap-4">
            {target && (
              <button
                className="inline-flex items-center gap-1 underline"
                onClick={async () => {
                  if (!window.confirm("Reset your copy of the demo to its starting point (v1 published)? Your review work in this copy will be lost.")) return;
                  await api.resetDemo(target);
                  window.location.reload();
                }}
              >
                <RotateCcw size={11} aria-hidden /> Reset my demo copy
              </button>
            )}
            {demoId && (
              <button
                className="underline"
                onClick={async () => {
                  if (!window.confirm("Start a brand-new copy of the demo?")) return;
                  const id = await newDemo();
                  router.push(`/handovers/${id}/ledger`);
                }}
              >
                New demo copy
              </button>
            )}
          </span>
        </div>
      </footer>
    </div>
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

/** Tell the header bell and nav badges that something changed. */
export const notifyChanged = () => typeof window !== "undefined" && window.dispatchEvent(new Event("continuum:changed"));

function NotificationBell({ hid }: { hid: string }) {
  const items = useNotifications(hid).filter((i) => i.count > 0);
  const total = items.reduce((n, i) => n + i.count, 0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button aria-label={`Things that need you: ${total}`} aria-expanded={open} onClick={() => setOpen(!open)} className="relative rounded p-2 text-current hover:bg-slate-500/15">
        <Bell size={18} aria-hidden />
        {total > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-[1.1rem] text-white">{total}</span>}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-800 shadow-lg">
          <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Needs your attention</p>
          {items.length === 0 && <p className="px-2 py-2 text-slate-600">Nothing right now.</p>}
          {items.map((i) => (
            <Link role="menuitem" key={i.key} href={`/handovers/${hid}/${i.tab}`} onClick={() => setOpen(false)} className="flex items-center justify-between rounded px-2 py-2 hover:bg-slate-100">
              <span>{i.label}</span>
              <span className="rounded-full bg-slate-100 px-2 text-xs font-semibold">{i.count}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Header() {
  const { role, setRole } = useSession();
  const router = useRouter();
  const hid = useHid();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 py-2 font-bold text-slate-900">
          <LogoMark size={36} /> <span className="text-lg tracking-tight">Continuum</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 md:inline-flex" title="Your own copy of the synthetic CampusKart demo. Nothing you do affects other visitors.">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> Demo: CampusKart (synthetic data)
          </span>
          <Link href="/tour" className="rounded px-2 py-2.5 font-medium text-current hover:bg-slate-500/15 sm:py-1">Judge&apos;s tour</Link>
          <HelpButton />
          {role && hid && role !== "guest" && <NotificationBell hid={hid} />}
          {role && (
            <>
              <Link href="/handovers" className="rounded px-2 py-2.5 text-current hover:bg-slate-500/15 sm:py-1">Handovers</Link>
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-900">Viewing as: {ROLE_META[role].label}</span>
              <button
                className="rounded px-2 py-1 text-current hover:bg-slate-500/15"
                onClick={() => {
                  setRole(null);
                  router.push("/");
                }}
              >
                Switch role
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

const TABS: { seg: string; label: string; roles: Role[]; badge?: string[] }[] = [
  { seg: "connect", label: "1 · Connect", roles: ["lead"] },
  { seg: "reconstruct", label: "2 · Reconstruct", roles: ["lead"] },
  { seg: "ledger", label: "3-4 · Verify & review", roles: ["lead"], badge: ["pending_claims"] },
  { seg: "conflicts", label: "Conflicts", roles: ["lead"], badge: ["conflicts"] },
  { seg: "tasks", label: "Questions", roles: ["lead"], badge: ["answered_tasks"] },
  { seg: "privacy", label: "Privacy", roles: ["lead"], badge: ["privacy"] },
  { seg: "interview", label: "Gap Interview", roles: ["leaver", "lead"], badge: ["tasks", "gaps"] },
  { seg: "activity", label: "Activity", roles: ["lead"] },
  { seg: "start", label: "5 · Start here", roles: ["contributor", "lead", "guest"], badge: ["to_ack"] },
];

/** Redirects to role-appropriate screen if the current role may not open this page. */
export function RoleGuard({ hid, allow, children }: { hid: string; allow: Role[]; children: ReactNode }) {
  const { role, ready } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    if (!role) router.replace("/");
    else if (!allow.includes(role)) router.replace(ROLE_META[role].home(hid));
  }, [ready, role, allow, hid, router]);
  if (!ready || !role || !allow.includes(role)) return <p className="text-sm text-slate-500">Checking your access…</p>;
  return <>{children}</>;
}

export function HandoverNav({ hid }: { hid: string }) {
  const { role } = useSession();
  const path = usePathname();
  const items = useNotifications(role && role !== "guest" ? hid : null);
  if (!role) return null;
  const count = (keys?: string[]) => (keys ?? []).reduce((n, k) => n + (items.find((i) => i.key === k)?.count ?? 0), 0);
  return (
    <nav aria-label="Handover steps" className="mb-5 flex gap-1 overflow-x-auto whitespace-nowrap border-b border-slate-200 pb-2 sm:flex-wrap sm:overflow-visible">
      {TABS.filter((t) => t.roles.includes(role)).map((t) => {
        const href = `/handovers/${hid}/${t.seg}`;
        const on = path === href;
        const n = count(t.badge);
        return (
          <Link key={t.seg} href={href} aria-current={on ? "page" : undefined} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-medium sm:py-1.5 ${on ? "bg-indigo-700 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
            {t.label}
            {n > 0 && <span aria-label={`${n} need attention`} className={`rounded-full px-1.5 text-[11px] font-bold ${on ? "bg-white/25 text-white" : "bg-rose-100 text-rose-800"}`}>{n}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
