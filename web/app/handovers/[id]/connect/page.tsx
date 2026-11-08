"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Source, SourceType } from "@/lib/types";
import { Button, Card, LabelTag, Notice, PageTitle, SourceStatusChip, sourceIcon } from "@/components/ui";
import { HandoverNav, RoleGuard } from "@/components/shell";

const KINDS: { type: SourceType; title: string; hint: string; accept?: string }[] = [
  { type: "chat_export", title: "Chat export", hint: "Slack / Discord JSON export (.zip or .json)", accept: ".json,.zip" },
  { type: "notes", title: "Notes and docs", hint: "Markdown or PDF", accept: ".md,.pdf,.txt" },
  { type: "issues", title: "Task board / issues export", hint: "GitHub Issues JSON/CSV (Trello CSV optional)", accept: ".json,.csv" },
];

export default function ConnectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [sources, setSources] = useState<Source[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");

  useEffect(() => {
    api.getSources(id).then(setSources).catch((e) => setErr((e as Error).message));
  }, [id]);

  async function add(body: Parameters<typeof api.addSource>[1]) {
    setErr(null);
    try {
      setSources(await api.addSource(id, body));
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  const input = "mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm";
  const hasProblems = sources?.some((s) => s.status === "partial" || s.status === "failed");

  return (
    <RoleGuard hid={id} allow={["lead"]}>
      <HandoverNav hid={id} />
      <PageTitle title="Connect sources" sub="Bring in only sources you are authorised to share. Each source is checked and labelled; incomplete sources are shown here and carried into the review so nothing is silently dropped." />
      {err && <Notice tone="error">{err}</Notice>}
      <div className="grid gap-4 md:grid-cols-5">
        <div className="space-y-4 md:col-span-3">
          <Card>
            <h2 className="font-semibold">Quick start for judges</h2>
            <p className="mt-1 text-sm text-slate-600">Loads the synthetic CampusKart sources (repo, chat, notes, issues, a lead-only mentor note).</p>
            <Button className="mt-3" variant="primary" onClick={() => add({ type: "github", name: "CampusKart sample sources", sample: true })}>Use CampusKart sample sources</Button>
          </Card>

          <Card>
            <h2 className="font-semibold">GitHub repository</h2>
            <p className="mt-1 text-xs text-slate-600">Read-only access: commits, PRs, issues, review comments, README. Use a fine-grained read-only token. The token is sent to the backend only and is never stored in this browser.</p>
            <label className="mt-3 block text-sm">Repository URL
              <input className={input} value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="https://github.com/owner/repo" />
            </label>
            <label className="mt-2 block text-sm">Read-only token (optional for public repos)
              <input className={input} type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" />
            </label>
            <Button className="mt-3" onClick={() => { add({ type: "github", name: repo || "GitHub repo", ref: repo }); setToken(""); }} disabled={!repo}>Connect repository</Button>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            {KINDS.map((k) => (
              <Card key={k.type}>
                <h2 className="text-sm font-semibold">{k.title}</h2>
                <p className="mt-1 text-xs text-slate-600">{k.hint}</p>
                <label className="mt-3 inline-block cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50">
                  Choose file
                  <input type="file" className="sr-only" accept={k.accept} onChange={(e) => { const f = e.target.files?.[0]; if (f) add({ type: k.type, name: f.name, ref: f.name }); e.target.value = ""; }} />
                </label>
              </Card>
            ))}
          </div>
        </div>

        <aside className="md:col-span-2">
          <Card>
            <h2 className="font-semibold">Connected sources</h2>
            {!sources && <p className="mt-2 text-sm text-slate-500">Loading…</p>}
            {sources?.length === 0 && <p className="mt-2 text-sm text-slate-600">Nothing connected yet.</p>}
            <ul className="mt-3 space-y-3">
              {sources?.map((s) => {
                const Icon = sourceIcon(s.type);
                return (
                  <li key={s.id} className="rounded-md border border-slate-200 p-2.5 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-medium"><Icon size={14} aria-hidden /> {s.name}</span>
                      <SourceStatusChip status={s.status} reason={s.status_reason} />
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                      <span>{s.unit_count} evidence units</span>
                      <LabelTag label={s.default_label} />
                    </div>
                    {s.status_reason && <p className={`mt-1 text-xs ${s.status === "failed" ? "text-rose-800" : "text-amber-800"}`}>{s.status === "failed" ? "Failed: " : "Partial: "}{s.status_reason}</p>}
                  </li>
                );
              })}
            </ul>
            {hasProblems && <div className="mt-3"><Notice tone="warn">Some sources are incomplete. The handover will say so instead of pretending coverage is complete.</Notice></div>}
            <Link href={`/handovers/${id}/reconstruct`} className={`mt-4 inline-flex w-full items-center justify-center rounded-md px-3 py-2 text-sm font-medium ${sources?.length ? "bg-indigo-700 text-white hover:bg-indigo-800" : "pointer-events-none bg-slate-200 text-slate-500"}`} aria-disabled={!sources?.length}>
              Continue to Reconstruct →
            </Link>
          </Card>
        </aside>
      </div>
    </RoleGuard>
  );
}
