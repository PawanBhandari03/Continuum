"use client";
import { use, useCallback, useEffect, useState } from "react";
import { CheckCircle2, Flag, Lock } from "lucide-react";
import { api } from "@/lib/api";
import { ROLE_META, useSession } from "@/lib/session";
import type { SuccessorView } from "@/lib/types";
import { Button, Card, Notice, PageTitle, fmtDate } from "@/components/ui";
import { HandoverNav, RoleGuard } from "@/components/shell";
import { ClaimCard } from "@/components/claim-card";
import { ExportButtons } from "@/components/export";
import { LoadError, SkeletonList } from "@/components/feedback";
import { friendlyError } from "@/lib/status";

export default function StartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { role, actor } = useSession();
  const [view, setView] = useState<SuccessorView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [flagging, setFlagging] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (!role) return;
    setLoadErr(null);
    try { setView(await api.getView(id, role)); } catch (e) { setLoadErr(friendlyError(e)); }
  }, [id, role]);
  useEffect(() => { load(); }, [load]);

  async function ack(section: string, status: "acknowledged" | "unclear", n?: string) {
    try { await api.ack(id, { section, status, note: n }, actor); setFlagging(null); setNote(""); await load(); } catch (e) { setErr(friendlyError(e)); }
  }

  const h = view?.handover;
  const acked = view?.sections.filter((s) => s.ack === "acknowledged").length ?? 0;

  return (
    <RoleGuard hid={id} allow={["contributor", "lead"]}>
      <HandoverNav hid={id} />
      <PageTitle
        title={h ? `Start here, ${h.successor}` : "Start here"}
        sub={h ? `Handover from ${h.leaver} · CampusKart · version ${h.version} · target ${fmtDate(h.target_date)}. Every claim shows its evidence state; click a source to read the original.` : undefined}
        right={view ? <ExportButtons hid={id} /> : undefined}
      />
      {loadErr && <div className="mb-3"><LoadError message={loadErr} onRetry={load} /></div>}
      {!view && !loadErr && <SkeletonList rows={4} label="Loading the handover" />}
      {err && <div className="mb-3"><Notice tone="error">{err}</Notice></div>}
      {h && h.status !== "published" && <div className="mb-4"><Notice tone="warn"><b>Draft preview.</b> The reviewer has not published this handover yet. In production a successor would see nothing until publish; the demo shows the current draft so you can explore this view. Role-based filtering below is real.</Notice></div>}
      {h?.status === "published" && <div className="mb-4"><Notice>Published and approved by <b>{h.approved_by}</b> on {fmtDate(h.published_at)}. This version is locked.</Notice></div>}
      {view && (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-700">
          <span>{acked} of {view.sections.length} sections acknowledged</span>
          {role && <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs">You are viewing as {ROLE_META[role].label}</span>}
          {view.hidden_count > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-300 bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-900"><Lock size={12} aria-hidden /> {view.hidden_count} item{view.hidden_count > 1 ? "s" : ""} hidden by your access level</span>}
        </div>
      )}
      <div className="space-y-8">
        {view?.sections.map((s, i) => (
          <section key={s.key} aria-labelledby={`s-${s.key}`} className={s.key === "unresolved" ? "rounded-lg border-2 border-amber-300 bg-amber-50/50 p-3" : ""}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 id={`s-${s.key}`} className="text-lg font-semibold">{i + 1}. {s.title}</h2>
              {s.ack !== "none" && (
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${s.ack === "acknowledged" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-amber-400 bg-amber-100 text-amber-900"}`}>
                  {s.ack === "acknowledged" ? <><CheckCircle2 size={12} /> Acknowledged</> : <><Flag size={12} /> Flagged unclear</>}
                </span>
              )}
            </div>
            {s.key === "unresolved" && <p className="mb-2 text-sm text-slate-700">Honest list of what nobody could confirm. Please follow these up; do not assume an answer.</p>}
            <div className="space-y-2.5">
              {s.claims.length === 0 && <p className="text-sm text-slate-600">Nothing visible to your role in this section.</p>}
              {s.claims.map((c) => <ClaimCard key={c.id} claim={c} />)}
            </div>
            {role === "contributor" && s.claims.length > 0 && (
              <div className="mt-3">
                {flagging === s.key ? (
                  <Card>
                    <label className="block text-sm font-medium">What is unclear? (optional)
                      <textarea className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm font-normal" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                    </label>
                    <div className="mt-2 flex gap-2"><Button variant="primary" onClick={() => ack(s.key, "unclear", note)}>Send to reviewer and leaver</Button><Button onClick={() => setFlagging(null)}>Cancel</Button></div>
                  </Card>
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={() => ack(s.key, "acknowledged")} disabled={s.ack === "acknowledged"}><CheckCircle2 size={14} aria-hidden /> I have read this</Button>
                    <Button onClick={() => setFlagging(s.key)}><Flag size={14} aria-hidden /> This is unclear</Button>
                  </div>
                )}
              </div>
            )}
          </section>
        ))}
      </div>
    </RoleGuard>
  );
}
