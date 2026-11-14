"use client";
import { use, useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Eye, Flag, Lock, MessageCircleQuestion, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { ROLE_META, useSession } from "@/lib/session";
import type { Role, SuccessorView, Task, VersionDiff } from "@/lib/types";
import { Button, Card, Notice, PageTitle, fmtDate } from "@/components/ui";
import { HandoverNav, RoleGuard, notifyChanged } from "@/components/shell";
import { ClaimCard } from "@/components/claim-card";
import { ExportButtons } from "@/components/export";
import { DiffView } from "@/components/version-diff";
import { LoadError, SkeletonList } from "@/components/feedback";
import { friendlyError } from "@/lib/status";

export default function StartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { role } = useSession();
  const [version, setVersion] = useState<number | undefined>(undefined);
  const [as, setAs] = useState<Role | "">(""); // reviewer preview
  const [view, setView] = useState<SuccessorView | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [showDiff, setShowDiff] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [flagging, setFlagging] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!role) return;
    setLoadErr(null);
    try {
      const v = await api.getView(id, role, { version, as: role === "lead" && as ? as : undefined });
      setView(v);
      if (role === "contributor") setTasks(await api.getTasks(id).catch(() => []));
      const base = v.last_ack_version || (v.version > 1 ? v.version - 1 : 0);
      if (!v.draft && base && base < v.version && (role !== "lead" || as)) {
        setDiff(await api.getVersionDiff(id, base, v.version).catch(() => null));
      } else setDiff(null);
    } catch (e) {
      setLoadErr(friendlyError(e));
    }
  }, [id, role, version, as]);
  useEffect(() => {
    load();
  }, [load]);

  async function ack(section: string, status: "acknowledged" | "unclear", n?: string) {
    if (busyKey) return;
    setBusyKey(section);
    setErr(null);
    try {
      await api.ack(id, { section, status, note: n });
      setFlagging(null);
      setNote("");
      notifyChanged();
      await load();
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusyKey(null);
    }
  }

  const h = view?.handover;
  const eff = (role === "lead" && as) || role;
  const canAck = role === "contributor" && view && !view.draft && !view.not_published && view.version === h?.version;
  const acked = view?.sections.filter((s) => s.ack === "acknowledged").length ?? 0;
  const carried = view?.sections.filter((s) => s.ack === "acknowledged" && s.carried_over).length ?? 0;
  const changedCount = view?.sections.filter((s) => s.changed).length ?? 0;
  const baseVersion = view ? view.last_ack_version || (view.version > 1 ? view.version - 1 : 0) : 0;

  return (
    <RoleGuard hid={id} allow={["contributor", "lead", "guest"]}>
      <HandoverNav hid={id} />
      <PageTitle
        title={h ? (eff === "guest" ? "Public handover (Guest view)" : `Start here, ${h.successor}`) : "Start here"}
        sub={h ? <>Handover from <span className="capitalize">{h.leaver}</span> · CampusKart · target {fmtDate(h.target_date)}. Every claim shows its evidence state; click a source to read the original.</> : undefined}
        right={view && !view.not_published && role !== "guest" ? <ExportButtons hid={id} version={view.draft ? undefined : view.version} /> : undefined}
      />
      {loadErr && <div className="mb-3"><LoadError message={loadErr} onRetry={load} /></div>}
      {!view && !loadErr && <SkeletonList rows={4} label="Loading the handover" />}
      {err && <div className="mb-3"><Notice tone="error">{err}</Notice></div>}

      {view && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          {view.versions.length > 0 && (
            <label className="inline-flex items-center gap-1.5">Version
              <select className="rounded-md border border-slate-300 bg-white px-2 py-1" value={version ?? view.version} onChange={(e) => setVersion(Number(e.target.value))} aria-label="Version">
                {view.versions.map((v, i) => <option key={v} value={v}>v{v}{i === 0 ? " (latest)" : ""}</option>)}
              </select>
            </label>
          )}
          {role === "lead" && (
            <label className="inline-flex items-center gap-1.5"><Eye size={14} aria-hidden /> Preview as
              <select className="rounded-md border border-slate-300 bg-white px-2 py-1" value={as} onChange={(e) => setAs(e.target.value as Role | "")} aria-label="Preview as role">
                <option value="">Reviewer (everything)</option>
                <option value="contributor">Successor</option>
                <option value="leaver">Leaver</option>
                <option value="guest">Guest</option>
              </select>
            </label>
          )}
          {view.sha256 && <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600" title={`SHA-256 ${view.sha256}`}>v{view.version} signed · {view.sha256.slice(0, 10)}…</span>}
          {view.hidden_count > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-teal-300 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-900"><Lock size={12} aria-hidden /> {view.hidden_count} item{view.hidden_count > 1 ? "s" : ""} hidden by {eff === role ? "your" : "this role's"} access level</span>}
        </div>
      )}

      {view?.not_published && <Notice tone="warn"><b>Not published yet.</b> The reviewer has not published a version of this handover. Successors see nothing until the first publish.</Notice>}
      {view?.draft && <div className="mb-4"><Notice tone="warn"><b>Draft preview (reviewer only).</b> This is the work in progress; the successor reads the latest published version.</Notice></div>}
      {role === "lead" && as && <div className="mb-4"><Notice>Previewing exactly what <b>{ROLE_META[as].label}</b> receives in v{view?.version}. Hidden items are counted, never shown.</Notice></div>}
      {view && !view.draft && !view.not_published && h?.published_at && version === undefined && (
        <div className="mb-4"><Notice>v{view.version} published by <b>{h.approved_by}</b> on {fmtDate(view.published_at ?? h.published_at)}. Published versions never change; later edits become a new version.</Notice></div>
      )}

      {diff && (diff.added.length + diff.changed.length + diff.removed.length > 0) && (
        <Card className="mb-6 border-amber-300 bg-amber-50/40">
          <button className="flex w-full items-center justify-between text-left" aria-expanded={showDiff} onClick={() => setShowDiff(!showDiff)}>
            <span className="inline-flex items-center gap-2 font-semibold text-slate-900">
              <Sparkles size={16} className="text-amber-700" aria-hidden /> What changed since {view?.last_ack_version ? "you last read" : "the previous version"} (v{baseVersion} → v{view?.version})
            </span>
            {showDiff ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {role === "contributor" && changedCount > 0 && <p className="mt-1 text-sm text-slate-700">{changedCount} section{changedCount > 1 ? "s" : ""} changed and need{changedCount > 1 ? "" : "s"} your acknowledgement again. Unchanged sections keep your earlier acknowledgement.</p>}
          {showDiff && <div className="mt-3"><DiffView diff={diff} from={`v${baseVersion}`} to={`v${view?.version}`} /></div>}
        </Card>
      )}

      {view && role === "contributor" && !view.not_published && (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-700" aria-live="polite">
          <span><b>{acked}</b> of {view.sections.length} sections acknowledged for v{view.version}{carried ? ` (${carried} carried over from an earlier version)` : ""}</span>
        </div>
      )}

      <div className="space-y-8">
        {view?.sections.map((s, i) => {
          const myTasks = tasks.filter((t) => t.section === s.key);
          return (
            <section key={s.key} aria-labelledby={`s-${s.key}`} className={s.key === "unresolved" ? "rounded-lg border-2 border-amber-300 bg-amber-50/50 p-3" : ""}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 id={`s-${s.key}`} className="flex items-center gap-2 text-lg font-semibold">
                  {i + 1}. {s.title}
                  {s.changed && <span className="rounded-full border border-amber-400 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Changed in v{view.version}</span>}
                </h2>
                {s.ack !== "none" && (
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${s.ack === "acknowledged" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-amber-400 bg-amber-100 text-amber-900"}`}>
                    {s.ack === "acknowledged" ? <><CheckCircle2 size={12} aria-hidden /> {s.carried_over ? "Acknowledged (carried over)" : "Acknowledged"}</> : <><Flag size={12} aria-hidden /> Flagged unclear</>}
                  </span>
                )}
              </div>
              {s.key === "unresolved" && <p className="mb-2 text-sm text-slate-700">Honest list of what nobody could confirm. Please follow these up; do not assume an answer.</p>}
              <div className="space-y-2.5">
                {s.claims.length === 0 && <p className="text-sm text-slate-600">Nothing visible to {eff === role ? "your role" : "this role"} in this section.</p>}
                {s.claims.map((c) => <ClaimCard key={c.id} claim={c} />)}
              </div>

              {myTasks.length > 0 && (
                <ul className="mt-3 space-y-2" aria-label="Your questions about this section">
                  {myTasks.map((t) => (
                    <li key={t.id} className="rounded-md border border-slate-200 bg-white p-2.5 text-sm">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600"><MessageCircleQuestion size={13} aria-hidden /> You asked (v{t.version_raised}):</div>
                      <p className="text-slate-900">“{t.text}”</p>
                      {t.status === "open" && <p className="mt-1 text-xs text-slate-600">Waiting for an answer from the leaver or the reviewer.</p>}
                      {t.answer && <p className="mt-1 rounded bg-emerald-50 p-1.5 text-slate-900"><b>{t.answer_by}:</b> “{t.answer}”</p>}
                      {t.status === "resolved" && <p className="mt-1 text-xs font-medium text-emerald-800">Resolved{t.version_resolved ? ` in v${t.version_resolved}` : ""}{t.resolution_note ? `: ${t.resolution_note}` : ""}</p>}
                      {t.status === "wont_fix" && <p className="mt-1 text-xs text-slate-600">Closed by the reviewer{t.resolution_note ? `: ${t.resolution_note}` : ""}</p>}
                    </li>
                  ))}
                </ul>
              )}

              {canAck && (
                <div className="mt-3">
                  {flagging === s.key ? (
                    <Card>
                      <label className="block text-sm font-medium">What is unclear? It goes to the leaver and the reviewer.
                        <textarea className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm font-normal" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Who do I ask for the deploy credentials?" />
                      </label>
                      <div className="mt-2 flex gap-2">
                        <Button variant="primary" disabled={busyKey === s.key || note.trim().length < 5} onClick={() => ack(s.key, "unclear", note)}>Send to reviewer and leaver</Button>
                        <Button onClick={() => setFlagging(null)}>Cancel</Button>
                      </div>
                    </Card>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => ack(s.key, "acknowledged")} disabled={s.ack === "acknowledged" || busyKey === s.key}><CheckCircle2 size={14} aria-hidden /> I have read this</Button>
                      <Button onClick={() => setFlagging(s.key)} disabled={busyKey === s.key}><Flag size={14} aria-hidden /> This is unclear</Button>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </RoleGuard>
  );
}
