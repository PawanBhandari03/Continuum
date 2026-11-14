"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import type { AccessLabel, Source } from "@/lib/types";
import { Button, Card, LabelTag, Notice, PageTitle, SourceStatusChip, sourceIcon } from "@/components/ui";
import { HandoverNav, RoleGuard } from "@/components/shell";
import { EmptyState, LoadError, SkeletonList } from "@/components/feedback";
import { friendlyError } from "@/lib/status";

const UPLOADS: { type: "chat_export" | "notes"; title: string; hint: string; accept: string }[] = [
  { type: "chat_export", title: "Chat export", hint: "Slack export as a .zip (the folder with users.json, channels.json and one folder per channel).", accept: ".zip" },
  { type: "notes", title: "Notes and docs", hint: "Markdown, text or PDF (.md, .txt, .pdf).", accept: ".md,.txt,.pdf" },
];

export default function ConnectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [sources, setSources] = useState<Source[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [repo, setRepo] = useState("");
  const [labels, setLabels] = useState<Record<string, AccessLabel>>({ chat_export: "contributor", notes: "contributor" });
  const [uploading, setUploading] = useState<string | null>(null);
  const [lastUpload, setLastUpload] = useState<Source | null>(null);

  const [loadErr, setLoadErr] = useState<string | null>(null);
  const load = useCallback(() => {
    setLoadErr(null);
    api.getSources(id).then(setSources).catch((e) => setLoadErr(friendlyError(e)));
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const norm = (u: string) => u.trim().toLowerCase().replace(/\.git$/, "").replace(/\/+$/, "");
  /** Returns a message if this source is already connected, so the same data is not ingested twice. */
  function duplicate(body: Parameters<typeof api.addSource>[1]): string | null {
    const list = sources ?? [];
    if (body.sample) return list.some((s) => /^CampusKart repo/.test(s.name)) ? "The CampusKart sample sources are already connected." : null;
    if (body.type === "github" && body.ref) return list.some((s) => norm(s.name) === norm(body.ref ?? "")) ? "This repository is already connected." : null;
    return null;
  }

  async function add(body: Parameters<typeof api.addSource>[1]) {
    setErr(null);
    const dup = duplicate(body);
    if (dup) {
      setErr(dup);
      return;
    }
    try {
      setSources(await api.addSource(id, body));
    } catch (e) {
      setErr(friendlyError(e));
    }
  }

  async function upload(type: "chat_export" | "notes", file: File) {
    setErr(null);
    setLastUpload(null);
    if ((sources ?? []).some((s) => s.type === type && s.name === file.name)) {
      setErr(`A file named ${file.name} is already connected. Rename the file if it is a different one.`);
      return;
    }
    setUploading(type);
    try {
      const s = await api.uploadSource(id, { type, file, label: labels[type] });
      setLastUpload(s);
      setSources(await api.getSources(id));
    } catch (e) {
      setErr(`Upload failed: ${friendlyError(e)}`);
    } finally {
      setUploading(null);
    }
  }

  const input = "mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm";
  const hasProblems = sources?.some((s) => s.status === "partial" || s.status === "failed");

  return (
    <RoleGuard hid={id} allow={["lead"]}>
      <HandoverNav hid={id} />
      <PageTitle title="Connect sources" sub="Bring in only sources you are authorised to share. Each source is checked and labelled; incomplete sources are shown here and carried into the review so nothing is silently dropped." />
      {err && <div className="mb-3"><Notice tone="error">{err}</Notice></div>}
      <div className="grid gap-4 md:grid-cols-5">
        <div className="space-y-4 md:col-span-3">
          <Card>
            <h2 className="font-semibold">Quick start for judges</h2>
            <p className="mt-1 text-sm text-slate-600">Loads the synthetic CampusKart sources (repo, chat, notes, issues, a lead-only mentor note).</p>
            <Button className="mt-3" variant="primary" onClick={() => add({ type: "github", name: "CampusKart sample sources", sample: true })}>Use CampusKart sample sources</Button>
          </Card>

          <Card>
            <h2 className="font-semibold">GitHub repository</h2>
            <p className="mt-1 text-xs text-slate-600">Reads README, commits, pull requests and comments, issues and TODO comments. Public repositories only in this build: the server reads them with its own read-only token, so you do not enter a token here.</p>
            <label className="mt-3 block text-sm">Repository URL
              <input className={input} value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="https://github.com/owner/repo" />
            </label>
            <Button className="mt-3" onClick={() => add({ type: "github", name: repo || "GitHub repo", ref: repo })} disabled={!repo}>Connect repository</Button>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            {UPLOADS.map((k) => (
              <Card key={k.type}>
                <h2 className="text-sm font-semibold">{k.title}</h2>
                <p className="mt-1 text-xs text-slate-600">{k.hint}</p>
                <label className="mt-3 block text-xs font-medium text-slate-700">Who may read this source
                  <select className={input} value={labels[k.type]} onChange={(e) => setLabels({ ...labels, [k.type]: e.target.value as AccessLabel })} aria-label={`Access label for ${k.title}`}>
                    <option value="contributor">Contributor (successor may see claims from it)</option>
                    <option value="public">Public</option>
                    <option value="lead_only">Lead only (never shown to the successor)</option>
                  </select>
                </label>
                <label className={`mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 focus-within:outline focus-within:outline-2 focus-within:outline-zinc-800 ${uploading ? "pointer-events-none opacity-60" : ""}`}>
                  {uploading === k.type ? <><Loader2 size={14} className="animate-spin" aria-hidden /> Uploading…</> : <><Upload size={14} aria-hidden /> Choose file</>}
                  <input type="file" className="sr-only" accept={k.accept} aria-label={`Upload ${k.title}`} disabled={!!uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(k.type, f); e.target.value = ""; }} />
                </label>
              </Card>
            ))}
          </div>
          <p className="text-xs text-slate-500">Use synthetic, public or permissioned data only. Do not upload confidential material. Files are limited to 25 MB.</p>
          <p className="text-xs text-slate-500">Task-board data comes from the issues of the GitHub repository; Trello and Word (.docx) imports are not built.</p>

          {lastUpload && (
            <div aria-live="polite">
              <Notice tone={lastUpload.status === "ok" ? "info" : lastUpload.status === "partial" ? "warn" : "error"}>
                <b>{lastUpload.name}</b>: {lastUpload.status === "ok" ? `read successfully, ${lastUpload.unit_count} evidence units.` : lastUpload.status === "partial" ? `partly read (${lastUpload.unit_count} evidence units). ${lastUpload.status_reason ?? ""}` : `could not be used. ${lastUpload.status_reason ?? ""}`}
              </Notice>
            </div>
          )}
        </div>

        <aside className="md:col-span-2">
          <Card>
            <h2 className="font-semibold">Connected sources</h2>
            {loadErr && <div className="mt-2"><LoadError message={loadErr} onRetry={load} /></div>}
            {!sources && !loadErr && <div className="mt-2"><SkeletonList rows={2} label="Loading sources" /></div>}
            {sources?.length === 0 && <div className="mt-2"><EmptyState title="Nothing connected yet" hint="Add a source, or use the CampusKart sample sources." /></div>}
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
