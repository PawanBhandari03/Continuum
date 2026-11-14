"use client";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { Bot, CheckCircle2, Circle, Cog, Loader2, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import type { AiStatus, JobStatus } from "@/lib/types";
import { Button, Card, Notice, PageTitle } from "@/components/ui";
import { HandoverNav, RoleGuard } from "@/components/shell";
import { friendlyError } from "@/lib/status";

const STAGES: { key: NonNullable<JobStatus["stage"]>; title: string; desc: string }[] = [
  { key: "parse", title: "Parse", desc: "Turn commits, PRs, messages and notes into evidence units; drop bots and noise." },
  { key: "protect", title: "Protect", desc: "Scan for secrets and personal data, redact, apply access labels." },
  { key: "extract", title: "Extract", desc: "Extract atomic claims. Each must cite evidence IDs and quote the source." },
  { key: "verify", title: "Verify", desc: "Check every citation exists and the quote matches; support check decides Verified." },
  { key: "conflicts_gaps", title: "Conflicts and gaps", desc: "Detect contradictions and missing owners; turn gaps into interview questions." },
];

export default function ReconstructPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [ai, setAi] = useState<AiStatus | null>(null);
  useEffect(() => {
    api.getAiStatus().then(setAi).catch(() => setAi(null));
  }, [job?.status]);

  async function start() {
    setErr(null);
    setJob({ status: "queued", stage: null, progress: 0, error: null });
    try {
      const { job_id } = await api.reconstruct(id);
      timer.current = setInterval(async () => {
        try {
          const s = await api.getJob(job_id);
          setJob(s);
          if (s.status === "done" || s.status === "failed") clearInterval(timer.current!);
        } catch (e) {
          clearInterval(timer.current!);
          setErr(friendlyError(e));
        }
      }, 700);
    } catch (e) {
      setJob(null);
      setErr(friendlyError(e));
    }
  }
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const idx = job?.stage ? STAGES.findIndex((s) => s.key === job.stage) : job?.status === "done" ? STAGES.length : -1;

  return (
    <RoleGuard hid={id} allow={["lead"]}>
      <HandoverNav hid={id} />
      <PageTitle title="Reconstruct" sub="Runs the pipeline on the connected sources. Failures are shown with a reason, never hidden." right={<Button variant="primary" onClick={start} disabled={job?.status === "running" || job?.status === "queued"}>{job ? "Run again" : "Start reconstruction"}</Button>} />
      {ai && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          {ai.mode === "rules" || !ai.model_configured ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800"><Cog size={13} aria-hidden /> Rules mode: no AI is used. Claims come from deterministic patterns and are labelled “Rule”.</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900"><Bot size={13} aria-hidden /> AI available, with automatic rules fallback if it fails</span>
          )}
          {(ai.calls.rules ?? 0) > 0 && ai.mode !== "rules" && <span className="text-xs text-amber-900">{ai.calls.rules} step(s) fell back to rules because the AI was unavailable.</span>}
        </div>
      )}
      {err && <Notice tone="error">{err}</Notice>}
      {err && <div className="mt-2"><Button onClick={start}>Retry</Button></div>}
      {job?.status === "failed" && <Notice tone="error">Reconstruction failed: {job.error ?? "unknown error"}. Nothing was published; you can run it again.</Notice>}
      {job?.status === "done" && job.error && <Notice tone="warn"><b>Finished with warnings.</b> Some parts did not complete, so the handover may be missing claims: {job.error}</Notice>}
      <Card className="mt-3">
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={job?.progress ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="Reconstruction progress">
          <div className="h-full bg-zinc-900 transition-all" style={{ width: `${job?.progress ?? 0}%` }} />
        </div>
        <ol className="space-y-3">
          {STAGES.map((s, i) => {
            const done = idx > i || job?.status === "done";
            const active = idx === i && job?.status === "running";
            const failed = job?.status === "failed" && job.stage === s.key;
            return (
              <li key={s.key} className="flex items-start gap-3">
                {failed ? <XCircle className="mt-0.5 text-rose-600" size={18} aria-hidden /> : done ? <CheckCircle2 className="mt-0.5 text-emerald-600" size={18} aria-hidden /> : active ? <Loader2 className="mt-0.5 animate-spin text-zinc-900" size={18} aria-hidden /> : <Circle className="mt-0.5 text-slate-300" size={18} aria-hidden />}
                <div>
                  <div className="font-medium">{i + 1}. {s.title} <span className="text-xs font-normal text-slate-600">{done ? "done" : active ? "running…" : failed ? "failed" : "waiting"}</span></div>
                  <div className="text-sm text-slate-600">{s.desc}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>
      {job?.status === "done" && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Notice>Reconstruction finished. Claims are ready for review.</Notice>
          <Link href={`/handovers/${id}/ledger`} className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">Open the claim ledger →</Link>
        </div>
      )}
    </RoleGuard>
  );
}
