"use client";
import { useState } from "react";
import { FileCheck2, ShieldCheck, ShieldX } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, Notice, PageTitle, fmtDateTime } from "@/components/ui";
import { friendlyError } from "@/lib/status";

/** Public page: check that an exported handover file is genuine and unchanged. No sign-in, no role needed. */
export default function VerifyPage() {
  const [text, setText] = useState("");
  const [res, setRes] = useState<{ ok: boolean; reason: string; version?: number; published_at?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check(t = text) {
    setBusy(true);
    setErr(null);
    setRes(null);
    try {
      setRes(await api.verifyExport(t));
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  async function onFile(f: File | undefined) {
    if (!f) return;
    const t = await f.text();
    setText(t);
    await check(t);
  }

  return (
    <>
      <PageTitle
        title="Verify an exported handover"
        sub="Every Markdown export of a published version ends with a signature line made by the Continuum server. Paste the file (or choose it) to check that it is genuine and that not one character was changed after export."
      />
      <Card>
        <label className="block text-sm font-medium">Exported file (.md)
          <input type="file" accept=".md,text/markdown,text/plain" className="mt-1.5 block w-full text-sm text-ink-soft file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-line file:bg-white file:px-3.5 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:bg-canvas" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <label className="mt-3 block text-sm font-medium">…or paste its text
          <textarea className="mt-1.5 h-48 w-full rounded-lg border border-line bg-white p-3 font-mono text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" value={text} onChange={(e) => setText(e.target.value)} placeholder="# Handover: Aditi → Karan (CampusKart) …" />
        </label>
        <div className="mt-3"><Button variant="primary" disabled={!text.trim() || busy} onClick={() => check()}><FileCheck2 size={14} aria-hidden /> {busy ? "Checking…" : "Verify"}</Button></div>
        {err && <div className="mt-3"><Notice tone="error">{err}</Notice></div>}
        {res && (
          <div className="mt-3">
            {res.ok ? (
              <Notice><span className="inline-flex items-start gap-1.5"><ShieldCheck size={16} aria-hidden className="mt-0.5" /> <span><b>{res.reason}</b>{res.published_at ? ` Published ${fmtDateTime(res.published_at)}.` : ""}</span></span></Notice>
            ) : (
              <Notice tone="error"><span className="inline-flex items-start gap-1.5"><ShieldX size={16} aria-hidden className="mt-0.5" /> <b>Not verified.</b> {res.reason}</span></Notice>
            )}
          </div>
        )}
      </Card>
      <p className="mt-4 text-xs text-slate-500">How it works: the export records a fingerprint (SHA-256) of the text and of the published version, and the server signs both with a secret key (HMAC). Changing the text, the version number or the signature line makes the check fail.</p>
    </>
  );
}
