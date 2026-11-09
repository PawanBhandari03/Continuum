"use client";
import { use, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Claim, Conflict } from "@/lib/types";
import { Button, Card, Notice, PageTitle, fmtDate } from "@/components/ui";
import { HandoverNav, RoleGuard } from "@/components/shell";
import { ClaimCard } from "@/components/claim-card";
import { invalidateEvidence } from "@/components/evidence";
import { EmptyState, LoadError, SkeletonList } from "@/components/feedback";
import { friendlyError } from "@/lib/status";

export default function ConflictsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { actor } = useSession();
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [keep, setKeep] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    try { const [cf, cl] = await Promise.all([api.getConflicts(id), api.getClaims(id)]); setConflicts(cf); setClaims(cl); }
    catch (e) { setLoadErr(friendlyError(e)); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function resolve(c: Conflict, resolution: "resolved" | "unresolved_followup") {
    setErr(null);
    try {
      await api.resolveConflict(c.id, { resolution, note: notes[c.id] ?? "", keep_claim_id: keep[c.id] }, actor);
      invalidateEvidence();
      await load();
    } catch (e) { setErr(friendlyError(e)); }
  }

  return (
    <RoleGuard hid={id} allow={["lead"]}>
      <HandoverNav hid={id} />
      <PageTitle title="Conflicts" sub="Sources disagree. Continuum shows both sides with dates and never assumes the newest is correct. You decide, or you mark it for the successor to follow up." />
      {err && <div className="mb-3"><Notice tone="error">{err}</Notice></div>}
      {loadErr && <LoadError message={loadErr} onRetry={load} />}
      {!conflicts && !loadErr && <SkeletonList rows={1} label="Loading conflicts" />}
      {conflicts?.length === 0 && <EmptyState title="No conflicts detected" hint="Nothing in the connected sources contradicts anything else." />}
      <div className="space-y-6">
        {conflicts?.map((cf) => {
          const sides = cf.claim_ids.map((cid) => claims.find((c) => c.id === cid)).filter(Boolean) as Claim[];
          const done = cf.resolution !== "open";
          return (
            <Card key={cf.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">{cf.summary}</h2>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${cf.resolution === "open" ? "border-rose-300 bg-rose-50 text-rose-900" : "border-emerald-300 bg-emerald-50 text-emerald-900"}`}>
                  {cf.resolution === "open" ? "Open" : cf.resolution === "resolved" ? "Resolved" : "Unresolved — successor to follow up"}
                </span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {sides.map((c) => (
                  <div key={c.id}>
                    <label className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-700">
                      <input type="radio" name={`keep-${cf.id}`} disabled={done} checked={keep[cf.id] === c.id} onChange={() => setKeep({ ...keep, [cf.id]: c.id })} />
                      Side dated {fmtDate(c.date)} {done && c.review_status === "rejected" ? "(not kept)" : ""}
                    </label>
                    <ClaimCard claim={c} />
                  </div>
                ))}
              </div>
              {done ? (
                <p className="mt-3 text-sm text-slate-700">{cf.resolution === "resolved" ? "Resolved" : "Marked unresolved"} by <b>{cf.resolved_by}</b>{cf.note ? `: ${cf.note}` : "."} {cf.resolution === "unresolved_followup" && "Both claims go to the successor under “Still unresolved”."}</p>
              ) : (
                <div className="mt-3 space-y-2">
                  <label className="block text-sm">Resolution note (who decided and why)
                    <textarea className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" rows={2} value={notes[cf.id] ?? ""} onChange={(e) => setNotes({ ...notes, [cf.id]: e.target.value })} placeholder="e.g. Confirmed with Dev on call: Vercel is the live frontend, Render hosts the API only." />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" disabled={!keep[cf.id] || !(notes[cf.id] ?? "").trim()} onClick={() => resolve(cf, "resolved")}>Keep selected side and resolve</Button>
                    <Button onClick={() => resolve(cf, "unresolved_followup")}>Mark unresolved — successor to follow up</Button>
                  </div>
                  <p className="text-xs text-slate-500">Select one side and write a note to resolve it. Neither side is pre-selected.</p>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </RoleGuard>
  );
}
