"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { ROLE_META } from "@/lib/session";
import type { Handover, Role } from "@/lib/types";
import { Button, Card, Notice, PageTitle, fmtDate } from "@/components/ui";
import { HandoverNav, RoleGuard } from "@/components/shell";
import { LoadError, SkeletonList } from "@/components/feedback";
import { friendlyError } from "@/lib/status";

type Row = { email: string; role: Role; invited_by: string | null; created_at: string; joined: boolean };

export default function PeoplePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("contributor");
  const [err, setErr] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signedIn = typeof window !== "undefined" && !!getSession();
  const [h, setH] = useState<Handover | null>(null);
  useEffect(() => {
    api.getHandover(id).then(setH).catch(() => {});
  }, [id]);
  const demoRole = (r: string) =>
    /leaving/i.test(r) ? "Leaver" : /successor/i.test(r) ? "Successor" : /lead|mentor/i.test(r) ? "Can review" : null;

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      setRows(await api.listMembers(id));
    } catch (e) {
      setLoadErr(friendlyError(e));
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      setRows(await api.addMember(id, email, role));
      setEmail("");
    } catch (x) {
      setErr(friendlyError(x));
    } finally {
      setBusy(false);
    }
  }
  const input = "mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm";
  return (
    <RoleGuard hid={id} allow={["lead"]}>
      <HandoverNav hid={id} />
      <PageTitle title="People" sub="Who can open this handover, and as what. A person signs in with the invited email and sees only what their role allows; the database enforces it, not just this app." />
      {!signedIn && (
        <>
          {!!h?.meta?.team?.length && (
            <Card>
              <h2 className="font-semibold text-ink">Project team</h2>
              <p className="mt-1 text-sm text-ink-soft">The people in this demo project. Everyone else on the team would be invited as a Contributor or Guest.</p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {h.meta.team.map((m) => {
                  const tag = demoRole(m.role);
                  return (
                    <li key={m.name} className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-white p-3">
                      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                        {m.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">{m.name}</span>
                        <span className="block truncate text-sm text-ink-soft">{m.role}</span>
                      </span>
                      {tag && <span className="shrink-0 whitespace-nowrap rounded-full border border-line bg-canvas px-2 py-0.5 text-xs font-semibold text-ink-soft">{tag}</span>}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
          <div className="mt-4">
            <Notice tone="info">In the demo you switch roles from the menu at the top right. <Link className="underline" href="/signin">Sign in</Link> and create your own handover to invite real people by email; the database then enforces what each person can see.</Notice>
          </div>
        </>
      )}
      {loadErr && signedIn && <LoadError message={loadErr} onRetry={load} />}
      {!rows && !loadErr && signedIn && <SkeletonList rows={2} label="Loading people" />}
      {signedIn && rows && (
        <div className="grid gap-4 md:grid-cols-5">
          <div className="space-y-2 md:col-span-3">
            {rows.map((m) => (
              <Card key={m.email} className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="font-medium">{m.email}</p><p className="text-xs text-slate-500">Invited by {m.invited_by ?? "—"} · {fmtDate(m.created_at)} · {m.joined ? "has signed in" : "has not signed in yet"}</p></div>
                <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-semibold">{ROLE_META[m.role].label}</span>
              </Card>
            ))}
          </div>
          <Card className="md:col-span-2">
            <h2 className="font-semibold">Invite someone</h2>
            <form onSubmit={invite} className="mt-3 space-y-3 text-sm">
              <label className="block">Email<input required type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="karan@college.edu" /></label>
              <label className="block">Role
                <select className={input} value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value="contributor">Successor (reads what contributors may see)</option>
                  <option value="leaver">Leaver (answers questions)</option>
                  <option value="guest">Guest (public only)</option>
                  <option value="lead">Reviewer (sees and decides everything)</option>
                </select>
              </label>
              {err && <Notice tone="error">{err}</Notice>}
              <Button variant="primary" type="submit" disabled={busy}><UserPlus size={14} aria-hidden /> {busy ? "Inviting…" : "Invite"}</Button>
              <p className="text-xs text-slate-500">They sign in at /signin with this email. No email is sent by Continuum itself: tell them to sign in.</p>
            </form>
          </Card>
        </div>
      )}
    </RoleGuard>
  );
}
