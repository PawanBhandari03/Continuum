"use client";
import { useMemo, useState } from "react";
import { GitCompare } from "lucide-react";
import { api } from "@/lib/api";
import { friendlyError } from "@/lib/status";
import type { Claim, VersionDiff, VersionEntry } from "@/lib/types";
import { wordDiff } from "@/lib/diff";
import { Button } from "./ui";
import { StateBadge } from "./ui";
import { EmptyState, LoadError } from "./feedback";

const asText = (v: string | Partial<Claim>) => (typeof v === "string" ? v : (v.statement ?? ""));
const asObj = (v: string | Partial<Claim>): Partial<Claim> => (typeof v === "string" ? { statement: v } : v);

const FIELD_LABEL: Record<string, string> = { state: "Evidence state", review_status: "Review status", sensitive: "Sensitive", label: "Access label", owner: "Owner" };

export function VersionCompare({ hid, versions }: { hid: string; versions: VersionEntry[] | null }) {
  const nums = useMemo(() => [...new Set((versions ?? []).map((v) => v.version))].sort((a, b) => a - b), [versions]);
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [claimsNow, setClaimsNow] = useState<Claim[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const f = from ?? nums[0];
  const t = to ?? nums[nums.length - 1];

  async function run() {
    if (f == null || t == null) return;
    setBusy(true);
    setErr(null);
    setDiff(null);
    try {
      const [d, c] = await Promise.all([api.getVersionDiff(hid, f, t), api.getClaims(hid).catch(() => [] as Claim[])]);
      setDiff(d);
      setClaimsNow(c);
    } catch (e) {
      const msg = friendlyError(e);
      setErr(/not found|404|no stored snapshot/i.test(msg) ? "Comparing these versions isn't available on this server yet, or one of them has no stored snapshot." : msg);
    } finally {
      setBusy(false);
    }
  }

  if (nums.length < 2) return <EmptyState title="Only one version so far" hint="Once claims are reviewed or the handover is published there will be versions to compare." />;
  const sel = "rounded-md border border-slate-300 bg-white px-2 py-1 text-sm";
  const textOf = (id: string) => claimsNow.find((c) => c.id === id)?.statement;

  return (
    <section aria-label="Compare versions" className="rounded-md border border-slate-200 p-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold"><GitCompare size={15} aria-hidden /> Compare two versions</h3>
      <div className="mt-2 flex flex-wrap items-end gap-2 text-sm">
        <label>From<select aria-label="From version" className={`${sel} ml-1`} value={f} onChange={(e) => { setFrom(Number(e.target.value)); setDiff(null); }}>{nums.map((n) => <option key={n} value={n}>v{n}</option>)}</select></label>
        <label>To<select aria-label="To version" className={`${sel} ml-1`} value={t} onChange={(e) => { setTo(Number(e.target.value)); setDiff(null); }}>{nums.map((n) => <option key={n} value={n}>v{n}</option>)}</select></label>
        <Button variant="primary" onClick={run} disabled={busy || f === t}>{busy ? "Comparing…" : "Show changes"}</Button>
      </div>
      {f === t && <p className="mt-1 text-xs text-slate-500">Pick two different versions.</p>}
      {err && <div className="mt-3"><LoadError message={err} onRetry={run} /></div>}

      {diff && (
        <div className="mt-3 space-y-4" aria-live="polite">
          <p className="text-sm font-medium" data-testid="diff-summary">
            v{f} → v{t}: {diff.added.length} added · {diff.removed.length} removed · {diff.changed.length} changed
          </p>
          {diff.added.length + diff.removed.length + diff.changed.length === 0 && <p className="text-sm text-slate-600">No claim changed between these versions.</p>}

          {diff.added.length > 0 && (
            <div><h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">Added</h4>
              <ul className="space-y-1.5">{diff.added.map((c) => <li key={c.id} className="rounded border border-emerald-200 bg-emerald-50/40 p-2 text-sm"><StateBadge state={c.state} /> <span className="underline decoration-emerald-600">{c.statement}</span></li>)}</ul></div>
          )}
          {diff.removed.length > 0 && (
            <div><h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-rose-800">Removed</h4>
              <ul className="space-y-1.5">{diff.removed.map((c) => <li key={c.id} className="rounded border border-rose-200 bg-rose-50/40 p-2 text-sm"><StateBadge state={c.state} /> <s>{c.statement}</s></li>)}</ul></div>
          )}
          {diff.changed.length > 0 && (
            <div><h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-800">Changed</h4>
              <ul className="space-y-2">
                {diff.changed.map((c) => {
                  const b = asObj(c.before);
                  const a = asObj(c.after);
                  const textChanged = b.statement !== undefined && a.statement !== undefined && b.statement !== a.statement;
                  const fields = (Object.keys(FIELD_LABEL) as (keyof Claim)[]).filter((k) => b[k] !== undefined && a[k] !== undefined && b[k] !== a[k]);
                  const rejected = a.review_status === "rejected" && b.review_status !== "rejected";
                  return (
                    <li key={c.claim_id} className="rounded border border-slate-200 p-2 text-sm">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                        {textChanged && <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-900">Edited text</span>}
                        {rejected && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-900">Rejected</span>}
                        {!textChanged && !rejected && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-800">Changed</span>}
                        <span className="font-normal text-slate-500">{c.claim_id}</span>
                      </div>
                      {textChanged ? (
                        <p aria-label="Text change">
                          {wordDiff(asText(c.before), asText(c.after)).map((p, i) =>
                            p.t === "same" ? <span key={i}>{p.w}</span> : p.t === "del" ? <del key={i} className="bg-rose-100 text-rose-900" title="removed">{p.w}</del> : <ins key={i} className="bg-emerald-100 text-emerald-900 underline" title="added">{p.w}</ins>,
                          )}
                        </p>
                      ) : (
                        <p>{asText(c.after) || textOf(c.claim_id) || "(claim text unchanged)"}</p>
                      )}
                      {fields.length > 0 && (
                        <ul className="mt-1 text-xs text-slate-700">
                          {fields.map((k) => <li key={k}>{FIELD_LABEL[k]}: <span className="line-through">{String(b[k])}</span> → <b>{String(a[k])}</b></li>)}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul></div>
          )}
        </div>
      )}
    </section>
  );
}
