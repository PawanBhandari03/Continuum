"use client";
import { useEffect, useState } from "react";
import { GitCompare } from "lucide-react";
import { api } from "@/lib/api";
import { friendlyError } from "@/lib/status";
import type { Claim, PublishedVersion, SectionKey, VersionDiff } from "@/lib/types";
import { wordDiff } from "@/lib/diff";
import { Button, StateBadge } from "./ui";
import { EmptyState, LoadError } from "./feedback";

export const SECTION_TITLE: Record<SectionKey, string> = {
  project: "Project in five lines", state: "Current state by workstream", decision_log: "Decision log", first_week: "Your first week",
  risks: "Risks and landmines", dependencies: "Dependencies and people", unresolved: "Still unresolved",
};
const FIELD_LABEL: Record<string, string> = { state: "Evidence state", section: "Section", owner: "Owner", type: "Type" };
const asText = (v: string | Partial<Claim>) => (typeof v === "string" ? v : (v.statement ?? ""));

/** The diff itself, grouped by section. Used by the reviewer's compare tool and the successor's "what changed". */
export function DiffView({ diff, from, to }: { diff: VersionDiff; from: string; to: string }) {
  const total = diff.added.length + diff.removed.length + diff.changed.length;
  const sections = Array.from(new Set<SectionKey>([
    ...diff.added.map((c) => c.section), ...diff.removed.map((c) => c.section),
    ...diff.changed.map((c) => (c.section ?? "state") as SectionKey),
  ]));
  return (
    <div className="space-y-4" aria-live="polite">
      <p className="text-sm font-medium" data-testid="diff-summary">
        {from} → {to}: {diff.added.length} added · {diff.removed.length} removed · {diff.changed.length} changed
        {diff.no_longer_visible ? ` · ${diff.no_longer_visible} no longer visible to you` : ""}
      </p>
      {total === 0 && <p className="text-sm text-slate-600">Nothing you can see changed between these versions.</p>}
      {sections.map((sec) => {
        const add = diff.added.filter((c) => c.section === sec);
        const rem = diff.removed.filter((c) => c.section === sec);
        const chg = diff.changed.filter((c) => (c.section ?? "state") === sec);
        if (!add.length && !rem.length && !chg.length) return null;
        return (
          <section key={sec} aria-label={SECTION_TITLE[sec]}>
            <h4 className="mb-1.5 text-sm font-semibold text-slate-900">{SECTION_TITLE[sec]}</h4>
            <ul className="space-y-1.5">
              {add.map((c) => (
                <li key={c.id} className="rounded border border-emerald-200 bg-emerald-50/50 p-2 text-sm">
                  <span className="mr-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-900">Added</span>
                  <StateBadge state={c.state} /> {c.statement}
                </li>
              ))}
              {chg.map((c) => {
                const textChanged = asText(c.before) !== asText(c.after);
                const fields = Object.entries(c.fields ?? {}).filter(([k]) => k !== "statement" && FIELD_LABEL[k]);
                return (
                  <li key={c.claim_id} className="rounded border border-amber-200 bg-amber-50/40 p-2 text-sm">
                    <span className="mr-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900">Changed</span>
                    {textChanged ? (
                      <span aria-label="Text change">
                        {wordDiff(asText(c.before), asText(c.after)).map((p, i) =>
                          p.t === "same" ? <span key={i}>{p.w}</span> : p.t === "del" ? <del key={i} className="bg-rose-100 text-rose-900" title="removed">{p.w}</del> : <ins key={i} className="bg-emerald-100 text-emerald-900 underline" title="added">{p.w}</ins>,
                        )}
                      </span>
                    ) : <span>{asText(c.after)}</span>}
                    {(fields.length > 0 || (c.new_evidence ?? 0) > 0) && (
                      <ul className="mt-1 text-xs text-slate-700">
                        {fields.map(([k, v]) => <li key={k}>{FIELD_LABEL[k]}: <span className="line-through">{String(v.before ?? "—")}</span> → <b>{String(v.after ?? "—")}</b></li>)}
                        {(c.new_evidence ?? 0) > 0 && <li>New evidence attached: {c.new_evidence}</li>}
                      </ul>
                    )}
                  </li>
                );
              })}
              {rem.map((c) => (
                <li key={c.id} className="rounded border border-slate-200 bg-slate-50 p-2 text-sm text-slate-600">
                  <span className="mr-1.5 rounded bg-slate-200 px-1.5 py-0.5 text-xs font-semibold text-slate-800">Removed</span>
                  <s>{c.statement}</s>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Reviewer tool: compare any two published versions, or the latest one with the current draft (0). */
export function VersionCompare({ hid, published, canDraft = true }: { hid: string; published: PublishedVersion[] | null; canDraft?: boolean }) {
  const nums = (published ?? []).map((v) => v.version).sort((a, b) => a - b);
  const options = canDraft ? [...nums, 0] : nums;
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const f = from ?? nums[nums.length - 1];
  const t = to ?? (canDraft ? 0 : nums[nums.length - 1]);
  useEffect(() => setDiff(null), [f, t]);
  const name = (n: number) => (n === 0 ? "current draft" : `v${n}`);

  async function run() {
    if (f == null || t == null) return;
    setBusy(true);
    setErr(null);
    try {
      setDiff(await api.getVersionDiff(hid, f, t));
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  if (!nums.length) return <EmptyState title="Nothing published yet" hint="After the first publish you can compare versions here." />;
  const sel = "rounded-md border border-slate-300 bg-white px-2 py-1 text-sm";
  return (
    <section aria-label="Compare versions" className="rounded-md border border-slate-200 p-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold"><GitCompare size={15} aria-hidden /> Compare versions</h3>
      <div className="mt-2 flex flex-wrap items-end gap-2 text-sm">
        <label>From<select aria-label="From version" className={`${sel} ml-1`} value={f} onChange={(e) => setFrom(Number(e.target.value))}>{options.filter((n) => n !== 0).map((n) => <option key={n} value={n}>{name(n)}</option>)}</select></label>
        <label>To<select aria-label="To version" className={`${sel} ml-1`} value={t} onChange={(e) => setTo(Number(e.target.value))}>{options.map((n) => <option key={n} value={n}>{name(n)}</option>)}</select></label>
        <Button variant="primary" onClick={run} disabled={busy || f === t}>{busy ? "Comparing…" : "Show changes"}</Button>
      </div>
      {err && <div className="mt-3"><LoadError message={err} onRetry={run} /></div>}
      {diff && <div className="mt-3"><DiffView diff={diff} from={name(f)} to={name(t)} /></div>}
    </section>
  );
}
