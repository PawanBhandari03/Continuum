"use client";
import { use, useCallback, useEffect, useState } from "react";
import { CheckCircle2, SkipForward } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { EvidenceDetail, Gap } from "@/lib/types";
import { Button, Card, Notice, PageTitle } from "@/components/ui";
import { HandoverNav, RoleGuard } from "@/components/shell";
import { chipLabel } from "@/components/evidence";

export default function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { actor } = useSession();
  const [gaps, setGaps] = useState<Gap[] | null>(null);
  const [found, setFound] = useState<Record<string, EvidenceDetail[]>>({});
  const [text, setText] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [g, claims] = await Promise.all([api.getGaps(id), api.getClaims(id)]);
      setGaps(g);
      const out: Record<string, EvidenceDetail[]> = {};
      for (const gap of g) {
        const c = claims.find((x) => x.id === gap.claim_id);
        if (c) out[gap.id] = await api.getEvidence(c.id, "leaver").catch(() => []);
      }
      setFound(out);
    } catch (e) { setErr((e as Error).message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function answer(g: Gap) {
    setErr(null);
    try { await api.answerGap(g.id, { answer: text[g.id] ?? "" }, actor); await load(); } catch (e) { setErr((e as Error).message); }
  }
  async function skip(g: Gap) { await api.skipGap(g.id); await load(); }

  const total = gaps?.length ?? 0;
  const done = gaps?.filter((g) => g.status !== "open").length ?? 0;

  return (
    <RoleGuard hid={id} allow={["leaver", "lead"]}>
      <HandoverNav hid={id} />
      <PageTitle title="Gap Interview" sub="Continuum read your project and found only these things it cannot answer from the evidence. Short answers are enough. Each answer is saved as new citable evidence (“Exit Q&A”) and the reviewer confirms it." />
      {err && <div className="mb-3"><Notice tone="error">{err}</Notice></div>}
      {gaps && (
        <div className="mb-4" aria-live="polite">
          <div className="flex justify-between text-sm"><span>{done} of {total} handled</span>{total > 0 && done === total && <span className="font-medium text-emerald-800">All done. Thank you.</span>}</div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-emerald-600" style={{ width: total ? `${(done / total) * 100}%` : "0%" }} /></div>
        </div>
      )}
      {gaps?.length === 0 && <Notice>No open questions. Run Reconstruct first if you expected some.</Notice>}
      <div className="space-y-4">
        {gaps?.map((g, i) => (
          <Card key={g.id}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Question {i + 1} of {total}</p>
            <h2 className="mt-1 font-semibold">{g.question}</h2>
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-md bg-slate-50 p-3">
                <div className="mb-1 text-xs font-semibold text-slate-600">What we found</div>
                <ul className="space-y-1.5">
                  {(found[g.id] ?? []).filter((d) => g.evidence_found.includes(d.citation.evidence_id)).map((d) => (
                    <li key={d.unit.id}><span className="font-medium">{chipLabel(d.unit)}</span> · <i>{d.unit.author}</i>: “{d.unit.text}”</li>
                  ))}
                  {!(found[g.id] ?? []).length && <li className="text-slate-500">Loading evidence…</li>}
                </ul>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <div className="mb-1 text-xs font-semibold text-slate-600">What is missing</div>
                <p>No source names the answer. We will not guess, so we are asking you.</p>
              </div>
            </div>
            {g.status === "open" ? (
              <div className="mt-3">
                <label className="block text-sm font-medium">Your answer
                  <textarea className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm font-normal" rows={3} value={text[g.id] ?? ""} onChange={(e) => setText({ ...text, [g.id]: e.target.value })} placeholder="Short and specific. Say “I don't know” if you don't." />
                </label>
                <div className="mt-2 flex gap-2">
                  <Button variant="primary" disabled={!(text[g.id] ?? "").trim()} onClick={() => answer(g)}>Save answer</Button>
                  <Button onClick={() => skip(g)}><SkipForward size={14} aria-hidden /> Skip</Button>
                </div>
                <p className="mt-2 text-xs text-slate-500">Please do not paste passwords or keys. Say who holds them instead.</p>
              </div>
            ) : (
              <p className={`mt-3 inline-flex items-center gap-1.5 text-sm ${g.status === "answered" ? "text-emerald-800" : "text-slate-600"}`}>
                <CheckCircle2 size={15} aria-hidden /> {g.status === "answered" ? <>Answered: “{g.answer}”. Saved as Exit Q&A evidence; waiting for reviewer approval.</> : "Skipped. This stays listed as Missing in the handover."}
              </p>
            )}
          </Card>
        ))}
      </div>
    </RoleGuard>
  );
}
