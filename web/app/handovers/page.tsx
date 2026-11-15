"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, GitMerge, HelpCircle, ListChecks, Loader2, Lock, PlusCircle, Users } from "lucide-react";
import { api } from "@/lib/api";
import { ROLE_META, useSession } from "@/lib/session";
import type { DemoProject, Handover } from "@/lib/types";
import { Button, Card, Notice, PageTitle, fmtDate } from "@/components/ui";
import { EmptyState, LoadError, SkeletonList } from "@/components/feedback";
import { friendlyError } from "@/lib/status";

const TONES = ["bg-brand-100 text-brand-800", "bg-emerald-100 text-emerald-800", "bg-amber-100 text-amber-900", "bg-rose-100 text-rose-800", "bg-violet-100 text-violet-800", "bg-sky-100 text-sky-900"];
const initials = (n: string) => n.replace(/\./g, "").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const tone = (n: string) => TONES[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];

function Person({ name, role }: { name: string; role: string }) {
  return (
    <li className="flex items-center gap-2 text-xs" title={`${name}: ${role}`}>
      <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${tone(name)}`} aria-hidden>{initials(name)}</span>
      <span className="min-w-0"><span className="block truncate font-semibold text-ink">{name}</span><span className="block text-ink-soft">{role}</span></span>
    </li>
  );
}

const statusOf = (h?: Handover) => (!h ? null : h.version ? (h.status === "published" ? `Published v${h.version}` : `v${h.version} live, editing v${h.version + 1}`) : "Draft");

export default function ProjectsPage() {
  const { role, ready, demoMap, ensureDemo } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<DemoProject[] | null>(null);
  const [copies, setCopies] = useState<Record<string, Handover>>({});
  const [mine, setMine] = useState<Handover[] | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [form, setForm] = useState({ leaver: "", successor: "", successor_role: "contributor" as "contributor" | "lead", target_date: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && !role) router.replace("/");
  }, [ready, role, router]);

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const [p, all] = await Promise.all([api.getDemoProjects(), api.listHandovers()]);
      setProjects(p);
      setMine(all.filter((h) => !h.is_demo));
      const entries = await Promise.all(Object.entries(demoMap).map(async ([k, id]) => [k, await api.getHandover(id).catch(() => null)] as const));
      setCopies(Object.fromEntries(entries.filter(([, h]) => h) as [string, Handover][]));
    } catch (e) {
      setLoadErr(friendlyError(e));
    }
  }, [demoMap]);
  useEffect(() => {
    if (ready) load();
  }, [ready, load]);
  if (!role) return null;

  async function open(key: string) {
    setErr(null);
    setOpening(key);
    try {
      const id = await ensureDemo(key);
      router.push(ROLE_META[role!].home(id));
    } catch (e) {
      setErr(friendlyError(e));
      setOpening(null);
    }
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const h = await api.createHandover(form);
      router.push(`/handovers/${h.id}/connect`);
    } catch (x) {
      setErr(friendlyError(x));
      setBusy(false);
    }
  }
  const input = "mt-1 w-full rounded-lg border border-[#c8d2e8] bg-white px-3 py-2 text-sm";

  return (
    <>
      <PageTitle
        eyebrow="Projects"
        title="Choose a handover to explore"
        sub="Every demo project below is a fictional team with its own leaver, evidence and planted problems. Opening one gives you your own private copy, so nothing you do affects other visitors."
      />
      {err && <div className="mb-4"><Notice tone="error">{err}</Notice></div>}
      {loadErr && <LoadError message={loadErr} onRetry={load} />}
      {!projects && !loadErr && <SkeletonList rows={3} label="Loading projects" />}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {projects?.map((p) => {
          const copy = copies[p.key];
          const team = p.meta.team ?? [];
          const isOpening = opening === p.key;
          return (
            <Card key={p.key} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-bold text-ink">{p.title}</h2>
                {copy ? (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">Your copy · {statusOf(copy)}</span>
                ) : (
                  <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800 ring-1 ring-brand-200">Demo</span>
                )}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{p.meta.description}</p>
              <p className="mt-3 text-sm"><b className="capitalize text-ink">{p.leaver}</b> <span className="text-ink-soft">is leaving. Takes over:</span> <b className="capitalize text-ink">{p.successor}</b> <span className="text-ink-soft">by {fmtDate(p.target_date)}</span></p>
              {p.meta.stack && (
                <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tech stack">
                  {p.meta.stack.map((t) => <li key={t} className="rounded-md bg-[#f5f8fe] px-2 py-0.5 text-xs font-medium text-ink-soft ring-1 ring-line">{t}</li>)}
                </ul>
              )}
              {team.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft"><Users size={13} aria-hidden /> Team</p>
                  <ul className="grid grid-cols-2 gap-x-3 gap-y-2">{team.slice(0, 6).map((m) => <Person key={m.name} name={m.name} role={m.role} />)}</ul>
                </div>
              )}
              <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
                <div><dt className="flex items-center justify-center gap-1 text-[11px] font-medium text-ink-soft"><ListChecks size={12} aria-hidden /> Claims</dt><dd className="text-lg font-bold text-ink">{p.claims}</dd></div>
                <div><dt className="flex items-center justify-center gap-1 text-[11px] font-medium text-ink-soft"><GitMerge size={12} aria-hidden /> Conflicts</dt><dd className="text-lg font-bold text-ink">{p.conflicts}</dd></div>
                <div><dt className="flex items-center justify-center gap-1 text-[11px] font-medium text-ink-soft"><HelpCircle size={12} aria-hidden /> Gaps</dt><dd className="text-lg font-bold text-ink">{p.gaps}</dd></div>
              </dl>
              <div className="mt-auto pt-4">
                <Button variant="primary" className="w-full" disabled={opening !== null} onClick={() => open(p.key)} aria-busy={isOpening}>
                  {isOpening ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Preparing your copy…</> : <>Open as {ROLE_META[role].short} <ArrowRight size={15} aria-hidden /></>}
                </Button>
                {isOpening && <p className="mt-2 text-xs text-ink-soft" role="status">Creating your own copy. This takes a few seconds (up to a minute if the free server was asleep).</p>}
              </div>
            </Card>
          );
        })}
      </div>

      <section className="mt-10" aria-labelledby="mine">
        <h2 id="mine" className="mb-3 flex items-center gap-2 text-lg font-bold text-ink"><Lock size={16} className="text-brand-600" aria-hidden /> Your own handovers</h2>
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="space-y-3 lg:col-span-3">
            {!mine && !loadErr && <SkeletonList rows={1} label="Loading your handovers" />}
            {mine?.length === 0 && <EmptyState title="None yet" hint="Create one to connect your own repo, chat export and notes. Sign in first if you want it private to you and the people you invite." />}
            {mine?.map((h) => (
              <Card key={h.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold capitalize text-ink">{h.leaver} → {h.successor}</p>
                  <p className="text-sm text-ink-soft">{h.version ? `Published v${h.version}` : "Not published yet"} · target {fmtDate(h.target_date)} · successor role: {h.successor_role}</p>
                </div>
                <Button variant="secondary" onClick={() => router.push(ROLE_META[role].home(h.id))}>Open as {ROLE_META[role].short}</Button>
              </Card>
            ))}
          </div>
          <div className="lg:col-span-2">
            {role === "lead" ? (
              <Card>
                <h3 className="flex items-center gap-2 font-semibold text-ink"><PlusCircle size={16} className="text-brand-600" aria-hidden /> Create a handover</h3>
                <form onSubmit={create} className="mt-3 space-y-3 text-sm">
                  <label className="block">Leaver (who is leaving)
                    <input required className={input} value={form.leaver} onChange={(e) => setForm({ ...form, leaver: e.target.value })} placeholder="e.g. aditi" />
                  </label>
                  <label className="block">Successor (who takes over)
                    <input required className={input} value={form.successor} onChange={(e) => setForm({ ...form, successor: e.target.value })} placeholder="e.g. karan" />
                  </label>
                  <label className="block">Successor&apos;s role
                    <select className={input} value={form.successor_role} onChange={(e) => setForm({ ...form, successor_role: e.target.value as "contributor" | "lead" })}>
                      <option value="contributor">Contributor (sees public + contributor sources)</option>
                      <option value="lead">Lead (sees everything)</option>
                    </select>
                  </label>
                  <label className="block">Handover target date
                    <input required type="date" className={input} value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
                  </label>
                  <Button variant="primary" type="submit" disabled={busy}>{busy ? "Creating…" : "Create and connect sources"}</Button>
                </form>
              </Card>
            ) : (
              <Notice>Only the Reviewer creates handovers. Switch role from the menu at the top right to try it.</Notice>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
