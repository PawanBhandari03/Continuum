"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ROLE_META, useSession } from "@/lib/session";
import type { Handover } from "@/lib/types";
import { Button, Card, Notice, PageTitle, fmtDate } from "@/components/ui";
import { EmptyState, LoadError, SkeletonList } from "@/components/feedback";
import { friendlyError } from "@/lib/status";

const STATUS: Record<Handover["status"], string> = { draft: "Draft: sources not yet reconstructed", in_review: "Draft in review", published: "Published, no pending changes" };

export default function HandoversPage() {
  const { role, ready, demoId } = useSession();
  const router = useRouter();
  const [list, setList] = useState<Handover[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ leaver: "", successor: "", successor_role: "contributor" as "contributor" | "lead", target_date: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && !role) router.replace("/");
  }, [ready, role, router]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const load = useCallback(() => {
    setLoadErr(null);
    // the shared template (h_1) is hidden once this browser has its own demo copy
    api.listHandovers(demoId).then((l) => setList(demoId ? l.filter((h) => h.id !== "h_1") : l)).catch((e) => setLoadErr(friendlyError(e)));
  }, [demoId]);
  useEffect(() => {
    load();
  }, [load]);
  if (!role) return null;

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
  const input = "mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm";

  return (
    <>
      <PageTitle title="Handovers" sub="Each handover is one leaver → one successor. The CampusKart demo below is your own copy: nothing you do affects other visitors." />
      {err && <Notice tone="error">{err}</Notice>}
      <div className="grid gap-4 md:grid-cols-5">
        <div className="space-y-3 md:col-span-3">
          {loadErr && <LoadError message={loadErr} onRetry={load} />}
          {!list && !loadErr && <SkeletonList rows={2} label="Loading handovers" />}
          {list?.length === 0 && <EmptyState title="No handovers yet" hint="Create one with the form to connect sources and start." />}
          {list?.map((h) => (
            <Card key={h.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold capitalize">{h.leaver} → {h.successor} <span className="text-sm font-normal normal-case text-slate-500">({h.is_demo ? (h.id === demoId ? "CampusKart demo · your copy" : "CampusKart demo template") : "new"})</span></h2>
                  <p className="text-sm text-slate-600">{h.version ? `Published v${h.version}` : "Not published yet"} · {STATUS[h.status]} · target {fmtDate(h.target_date)} · successor role: {h.successor_role}</p>
                  {h.published_at && <p className="text-xs text-slate-500">Last published by {h.approved_by} on {fmtDate(h.published_at)}</p>}
                </div>
                <Link href={ROLE_META[role].home(h.id)} className="inline-flex items-center rounded-md bg-indigo-700 px-3 py-2.5 text-sm font-medium text-white hover:bg-indigo-800 sm:py-1.5">
                  Open as {ROLE_META[role].label}
                </Link>
              </div>
            </Card>
          ))}
        </div>

        <div className="md:col-span-2">
          {role === "lead" ? (
            <Card>
              <h2 className="font-semibold">Create a handover</h2>
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
            <Notice>Only the Reviewer (Lead) creates handovers. Switch role (top right) to try it.</Notice>
          )}
        </div>
      </div>
    </>
  );
}
