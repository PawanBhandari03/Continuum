"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { LogoMark } from "./logo";
import { api, USE_MOCKS } from "@/lib/api";
import { ROLE_META, SessionProvider, useSession } from "@/lib/session";
import type { Role } from "@/lib/types";
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

function Frame({ children }: { children: ReactNode }) {
  const home = usePathname() === "/";
  return (
    <div className={home ? "min-h-screen bg-slate-950 text-white" : ""}>
      <Header dark={home} />
      <ServerBanner />
      <main className={home ? "w-full" : "mx-auto w-full max-w-6xl px-4 py-6"}>{children}</main>
      <footer className={`mx-auto max-w-6xl px-4 pb-24 pt-6 text-xs ${home ? "text-slate-400" : "text-slate-500"}`}>
        Continuum · Team BINARY BUILDERS · Demo project <strong>CampusKart</strong>: all data is synthetic; secrets and personal details in it are fake.
        {USE_MOCKS && (
          <button
            className="ml-3 inline-flex items-center gap-1 underline"
            onClick={async () => {
              await api.resetDemo();
              window.location.href = "/handovers";
            }}
          >
            <RotateCcw size={11} aria-hidden /> Reset demo
          </button>
        )}
      </footer>
    </div>
  );
}

function Header({ dark = false }: { dark?: boolean }) {
  const { role, setRole } = useSession();
  const router = useRouter();
  return (
    <>
      <header className={`sticky top-0 z-30 border-b backdrop-blur ${dark ? "border-white/10 bg-slate-950/80 text-white" : "border-slate-200 bg-white/85"}`}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className={`flex items-center gap-2 py-2 font-bold ${dark ? "text-white" : "text-slate-900"}`}>
<LogoMark size={36} /> <span className="text-lg tracking-tight">Continuum</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs md:inline-flex ${dark ? "border-white/15 bg-white/5 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-600"}`} title={USE_MOCKS ? "Running on the built-in demo data store in your browser." : "Connected to the live API."}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden /> Demo: CampusKart (synthetic data)
            </span>
            <HelpButton />
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
    </>
  );
}

const TABS: { seg: string; label: string; roles: Role[] }[] = [
  { seg: "connect", label: "1 · Connect", roles: ["lead"] },
  { seg: "reconstruct", label: "2 · Reconstruct", roles: ["lead"] },
  { seg: "ledger", label: "3-4 · Verify & review", roles: ["lead"] },
  { seg: "conflicts", label: "Conflicts", roles: ["lead"] },
  { seg: "interview", label: "Gap Interview", roles: ["leaver", "lead"] },
  { seg: "activity", label: "Review activity", roles: ["lead"] },
  { seg: "start", label: "5 · Start here", roles: ["contributor", "lead"] },
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
  if (!role) return null;
  return (
    <nav aria-label="Handover steps" className="mb-5 flex gap-1 overflow-x-auto whitespace-nowrap border-b border-slate-200 pb-2 sm:flex-wrap sm:overflow-visible">
      {TABS.filter((t) => t.roles.includes(role)).map((t) => {
        const href = `/handovers/${hid}/${t.seg}`;
        const on = path === href;
        return (
          <Link key={t.seg} href={href} aria-current={on ? "page" : undefined} className={`rounded-md px-3 py-2.5 text-sm font-medium sm:py-1.5 ${on ? "bg-indigo-700 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
