"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { RotateCcw, Waypoints } from "lucide-react";
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
          <Header />
          <ServerBanner />
          <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 pb-24 text-xs text-slate-500">
            Continuum · Team BINARY BUILDERS · All demo data is synthetic. Secrets and personal details in it are fake.
          </footer>
        </TourProvider>
      </EvidenceProvider>
    </SessionProvider>
  );
}

function Header() {
  const { role, setRole } = useSession();
  const router = useRouter();
  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 py-2 font-bold text-slate-900">
            <Waypoints className="text-indigo-700" size={20} aria-hidden /> Continuum
            <span className="hidden text-sm font-normal text-slate-500 sm:inline">Project handovers that show their work</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <HelpButton />
            {role && (
              <>
                <Link href="/handovers" className="rounded px-2 py-2.5 text-slate-700 hover:bg-slate-100 sm:py-1">Handovers</Link>
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-900">Viewing as: {ROLE_META[role].label}</span>
                <button
                  className="rounded px-2 py-1 text-slate-700 hover:bg-slate-100"
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
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900">
        Demo project: <strong>CampusKart</strong> (synthetic data). {USE_MOCKS ? "Running on the built-in demo data store in your browser." : "Connected to the live API."}
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
      </div>
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
    <nav aria-label="Handover steps" className="mb-5 flex flex-wrap gap-1 border-b border-slate-200 pb-2">
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
