"use client";
// Source chips + evidence drawer. Click a chip => original text in context, quote highlighted,
// redactions shown as blocks, author / time / link / access label / support level.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ExternalLink, X } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Claim, EvidenceDetail, EvidenceUnit } from "@/lib/types";
import { LabelTag, SourceStatusChip, fmtDateTime, sourceIcon } from "./ui";

const cache = new Map<string, Promise<EvidenceDetail[]>>();
export function invalidateEvidence() {
  cache.clear();
}
function loadEvidence(claimId: string, role: string) {
  const k = `${claimId}|${role}`;
  let p = cache.get(k);
  if (!p) {
    p = api.getEvidence(claimId, role as never);
    p.catch(() => cache.delete(k));
    cache.set(k, p);
  }
  return p;
}

export function chipLabel(u: EvidenceUnit): string {
  const l = u.locator;
  let m = l.match(/pull\/(\d+)/);
  if (m) return `PR #${m[1]}`;
  m = l.match(/commit\/([0-9a-f]{7})/);
  if (m) return `commit ${m[1]}`;
  m = l.match(/blob\/[^/]+\/([^#]+)/);
  if (m) return m[1];
  m = l.match(/^slack:\/\/([^/]+)\/(\d{4}-\d{2}-\d{2})/);
  if (m) return `#${m[1]} · ${m[2].slice(5)}`;
  m = l.match(/^notes:\/\/([^#]+)/);
  if (m) return m[1];
  if (l.startsWith("exit-qa://")) return "Exit Q&A";
  return u.author;
}

// ---- drawer context ----
interface DrawerCtx {
  open: (claim: Claim, evidenceId?: string) => void;
}
const Ctx = createContext<DrawerCtx>({ open: () => {} });
export const useEvidenceDrawer = () => useContext(Ctx);

export function EvidenceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ claim: Claim; evidenceId?: string } | null>(null);
  const open = useCallback((claim: Claim, evidenceId?: string) => setState({ claim, evidenceId }), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setState(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {state && <Drawer claim={state.claim} evidenceId={state.evidenceId} onClose={() => setState(null)} />}
    </Ctx.Provider>
  );
}

export function SourceChips({ claim }: { claim: Claim }) {
  const { role } = useSession();
  const { open } = useEvidenceDrawer();
  const [details, setDetails] = useState<EvidenceDetail[] | null>(null);
  useEffect(() => {
    if (!role) return;
    let live = true;
    loadEvidence(claim.id, role).then((d) => live && setDetails(d)).catch(() => live && setDetails([]));
    return () => {
      live = false;
    };
  }, [claim.id, claim.citations.length, role]);
  if (!claim.citations.length) return <span className="text-xs italic text-slate-500">No citations</span>;
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Sources">
      {claim.citations.map((c, i) => {
        const d = details?.find((x) => x.citation.evidence_id === c.evidence_id);
        const Icon = d ? sourceIcon(d.source.type) : sourceIcon("notes");
        return (
          <button
            key={c.evidence_id + i}
            onClick={() => open(claim, c.evidence_id)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-800 hover:border-indigo-400 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
            title="Open the original source text"
          >
            <Icon size={12} aria-hidden />
            {d ? chipLabel(d.unit) : `Source ${i + 1}`}
            {c.support === "partial" && <span className="text-amber-700" title="Partial support">~</span>}
          </button>
        );
      })}
    </div>
  );
}

// Render text with redaction blocks and a highlighted quote.
function Rendered({ unit, quote }: { unit: EvidenceUnit; quote?: string }) {
  const text = unit.text;
  let hs = -1,
    he = -1;
  if (quote) {
    const i = text.toLowerCase().indexOf(quote.toLowerCase());
    if (i >= 0) {
      hs = i;
      he = i + quote.length;
    }
  }
  const cuts = new Set<number>([0, text.length]);
  unit.redactions.forEach((r) => {
    cuts.add(r.start);
    cuts.add(r.end);
  });
  if (hs >= 0) {
    cuts.add(hs);
    cuts.add(he);
  }
  const pts = [...cuts].sort((a, b) => a - b);
  const parts: ReactNode[] = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const [a, b] = [pts[k], pts[k + 1]];
    const red = unit.redactions.find((r) => a >= r.start && b <= r.end);
    if (red) {
      if (a === red.start) parts.push(<span key={k} className="mx-0.5 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-slate-100" title={`Redacted (${red.kind})`}>█ redacted {red.kind} █</span>);
      continue;
    }
    const seg = text.slice(a, b);
    parts.push(a >= hs && b <= he && hs >= 0 ? <mark key={k} className="rounded bg-yellow-200 px-0.5 text-slate-900">{seg}</mark> : <span key={k}>{seg}</span>);
  }
  return <>{parts}</>;
}

function Drawer({ claim, evidenceId, onClose }: { claim: Claim; evidenceId?: string; onClose: () => void }) {
  const { role } = useSession();
  const [details, setDetails] = useState<EvidenceDetail[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!role) return;
    loadEvidence(claim.id, role).then(setDetails).catch((e) => setErr((e as Error).message));
  }, [claim.id, role]);
  const ordered = details ? [...details].sort((a, b) => (a.citation.evidence_id === evidenceId ? -1 : b.citation.evidence_id === evidenceId ? 1 : 0)) : [];
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Evidence viewer">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence for this claim</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{claim.statement}</p>
            {claim.confidence_reason && <p className="mt-1 text-xs text-slate-600">Why this state: {claim.confidence_reason}</p>}
          </div>
          <button onClick={onClose} aria-label="Close evidence viewer" className="rounded p-1 hover:bg-slate-100"><X size={18} /></button>
        </header>
        <div className="space-y-5 p-4">
          {err && <p className="rounded border border-rose-300 bg-rose-50 p-2 text-sm text-rose-900">{err}</p>}
          {!details && !err && <p className="text-sm text-slate-500">Loading original text…</p>}
          {details && ordered.length === 0 && <p className="text-sm text-slate-600">No readable evidence for your role.</p>}
          {ordered.map((d, i) => {
            const Icon = sourceIcon(d.source.type);
            return (
              <article key={d.citation.evidence_id + i} className={`rounded-lg border p-3 ${d.citation.evidence_id === evidenceId ? "border-indigo-400 ring-1 ring-indigo-200" : "border-slate-200"}`}>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <Icon size={14} aria-hidden />
                  <strong className="text-slate-900">{d.source.name}</strong>
                  <SourceStatusChip status={d.source.status} reason={d.source.status_reason} />
                  <LabelTag label={d.unit.label} />
                  <span className={`rounded border px-1.5 py-0.5 ${d.citation.support === "full" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
                    Support: {d.citation.support === "full" ? "supports" : "partially supports"}
                  </span>
                </div>
                {d.source.status !== "ok" && d.source.status_reason && <p className="mb-2 text-xs text-amber-800">Source note: {d.source.status_reason}</p>}
                <ol className="space-y-2 border-l-2 border-slate-200 pl-3">
                  {d.context.map((u) => {
                    const main = u.id === d.unit.id;
                    return (
                      <li key={u.id} className={main ? "rounded bg-slate-50 p-2" : "text-slate-500"}>
                        <div className="text-xs text-slate-500">
                          <span className="font-semibold">{u.author}</span> · {fmtDateTime(u.timestamp)}
                          {main && (
                            <a href={u.locator.startsWith("http") ? u.locator : undefined} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-0.5 text-indigo-700 hover:underline">
                              {u.locator.startsWith("http") ? <>open original <ExternalLink size={11} /></> : <code className="text-slate-500">{u.locator}</code>}
                            </a>
                          )}
                        </div>
                        <p className={`mt-0.5 text-sm ${main ? "text-slate-900" : ""}`}><Rendered unit={u} quote={main ? d.citation.quote : undefined} /></p>
                      </li>
                    );
                  })}
                </ol>
                <p className="mt-2 text-xs text-slate-500">Quoted span: “{d.citation.quote}”</p>
              </article>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
