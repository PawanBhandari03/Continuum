"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { friendlyError } from "@/lib/status";
import type { AuditEntry, Claim } from "@/lib/types";
import { Button, PageTitle, fmtDateTime } from "@/components/ui";
import { HandoverNav, RoleGuard } from "@/components/shell";
import { EmptyState, LoadError, SkeletonList } from "@/components/feedback";

type Group = "review" | "conflict" | "publish" | "handover" | "system";
const ACTIONS: Record<string, { label: string; group: Group }> = {
  approve: { label: "Approved", group: "review" },
  edit: { label: "Edited", group: "review" },
  reject: { label: "Rejected", group: "review" },
  redact: { label: "Redacted", group: "review" },
  mark_sensitive: { label: "Marked sensitive", group: "review" },
  resolve_conflict: { label: "Conflict resolved or marked", group: "conflict" },
  answer_gap: { label: "Gap answered (leaver)", group: "conflict" },
  publish: { label: "Published", group: "publish" },
  ack: { label: "Acknowledged (successor)", group: "handover" },
  flag_unclear: { label: "Flagged unclear (successor)", group: "handover" },
  create: { label: "Created", group: "system" },
  upload: { label: "Source uploaded", group: "system" },
  reconstruct: { label: "Reconstructed", group: "system" },
  reset: { label: "Demo reset", group: "system" },
};
const GROUP_CLS: Record<Group, string> = {
  review: "border-indigo-300 bg-indigo-50 text-indigo-900",
  conflict: "border-rose-300 bg-rose-50 text-rose-900",
  publish: "border-emerald-300 bg-emerald-50 text-emerald-900",
  handover: "border-amber-300 bg-amber-50 text-amber-900",
  system: "border-slate-300 bg-slate-50 text-slate-800",
};
const meta = (a: string) => ACTIONS[a] ?? { label: a.replace(/_/g, " "), group: "system" as Group };

export default function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const [a, c] = await Promise.all([api.getAudit(id), api.getClaims(id).catch(() => [] as Claim[])]);
      setRows(a);
      setClaims(c);
    } catch (e) {
      setLoadErr(friendlyError(e));
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const actors = useMemo(() => [...new Set((rows ?? []).map((r) => r.actor))].sort(), [rows]);
  const actions = useMemo(() => [...new Set((rows ?? []).map((r) => r.action))].sort(), [rows]);
  const shown = (rows ?? []).filter((r) => (!action || r.action === action) && (!actor || r.actor === actor));
  const sel = "rounded-md border border-slate-300 bg-white px-2 py-1 text-sm";

  return (
    <RoleGuard hid={id} allow={["lead"]}>
      <HandoverNav hid={id} />
      <PageTitle
        title="Review activity"
        sub="Who did what, and when: reviews, conflict decisions, the leaver's answers, publishing, and the successor's acknowledgements. Newest first. This is a record, not an undo list."
        right={<Button onClick={load}>Refresh</Button>}
      />
      {loadErr && <LoadError message={loadErr} onRetry={load} />}
      {!rows && !loadErr && <SkeletonList rows={4} label="Loading activity" />}
      {rows?.length === 0 && <EmptyState title="No activity recorded yet" hint="Approve, edit or publish something in the claim ledger and it will appear here." />}
      {rows && rows.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Filters">
            <span className="text-slate-600">Filter:</span>
            <select aria-label="Action" className={sel} value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">All actions</option>
              {actions.map((a) => <option key={a} value={a}>{meta(a).label}</option>)}
            </select>
            <select aria-label="Person" className={sel} value={actor} onChange={(e) => setActor(e.target.value)}>
              <option value="">Everyone</option>
              {actors.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            {(action || actor) && <button className="text-indigo-700 underline" onClick={() => { setAction(""); setActor(""); }}>Clear</button>}
            <span className="ml-auto text-slate-500">{shown.length} of {rows.length} entries</span>
          </div>
          <ol className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white" aria-label="Activity log">
            {shown.map((r, i) => {
              const m = meta(r.action);
              const claim = r.claim_id ? claims.find((c) => c.id === r.claim_id) : null;
              return (
                <li key={`${r.at}-${i}`} className="grid gap-1 p-3 text-sm sm:grid-cols-[11rem_1fr]">
                  <div className="text-xs text-slate-500">
                    <time dateTime={r.at}>{fmtDateTime(r.at)}</time>
                    <div className="font-semibold capitalize text-slate-800">{r.actor}</div>
                  </div>
                  <div>
                    <span className={`mr-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${GROUP_CLS[m.group]}`}>{m.label}</span>
                    <span className="text-slate-900">{r.summary}</span>
                    {claim && <div className="mt-0.5 text-xs text-slate-500">Claim: “{claim.statement.slice(0, 110)}{claim.statement.length > 110 ? "…" : ""}”</div>}
                    {r.claim_id && !claim && <div className="mt-0.5 text-xs text-slate-500">Claim id: {r.claim_id}</div>}
                  </div>
                </li>
              );
            })}
          </ol>
          {shown.length === 0 && <p className="mt-3 text-sm text-slate-600">No entries match these filters.</p>}
        </>
      )}
    </RoleGuard>
  );
}
