"use client";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Printer } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { friendlyError } from "@/lib/status";
import { GENERATED_LINE, buildExportModel, downloadText, exportFileName, headerLines, toMarkdown, type ExportModel } from "@/lib/export";
import { Button } from "./ui";

const STATE_LABEL = { verified: "Verified", inferred: "Inferred", conflicting: "Conflicting", missing: "Missing", confirmed: "Confirmed" } as const;

/** "Export as Markdown" + "Print / Save as PDF" for the current role's view of the handover. */
export function ExportButtons({ hid, version }: { hid: string; version?: number }) {
  const { role } = useSession();
  const [busy, setBusy] = useState<"md" | "print" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [printModel, setPrintModel] = useState<ExportModel | null>(null);

  const make = useCallback(async (format: string) => {
    if (!role) throw new Error("Choose a role first.");
    const m = await buildExportModel(api, hid, role, version);
    if (format !== "markdown") await api.logExport(hid, format, m.version || undefined); // every export is recorded in the audit log
    return m;
  }, [hid, role, version]);

  async function exportMd() {
    setErr(null);
    setBusy("md");
    try {
      const m = await make("markdown");
      // sign the exact text: the server returns an HMAC line over (handover, version, snapshot hash, text hash)
      const body = toMarkdown(m).replace(/\n+$/, "") + "\n";
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
      const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
      const r = await api.logExport(hid, "markdown", m.version || undefined, hex);
      downloadText(exportFileName(m, "md"), r.signature ? `${body}\n${r.signature}\n` : body);
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }
  async function printIt() {
    setErr(null);
    setBusy("print");
    try {
      setPrintModel(await make("pdf"));
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  // print once the printable portal has rendered; clear it afterwards
  useEffect(() => {
    if (!printModel) return;
    const done = () => setPrintModel(null);
    window.addEventListener("afterprint", done);
    const t = setTimeout(() => window.print(), 100);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [printModel]);

  return (
    <div className="no-print flex flex-col items-start gap-1">
      <div className="flex flex-wrap gap-2">
        <Button onClick={exportMd} disabled={busy !== null}><Download size={14} aria-hidden /> {busy === "md" ? "Preparing…" : "Export as Markdown"}</Button>
        <Button onClick={printIt} disabled={busy !== null}><Printer size={14} aria-hidden /> {busy === "print" ? "Preparing…" : "Print / Save as PDF"}</Button>
      </div>
      {err && <p role="alert" className="max-w-sm text-right text-xs text-rose-800">Export failed: {err}</p>}
      {printModel && typeof document !== "undefined" && createPortal(<PrintableHandover model={printModel} />, document.body)}
    </div>
  );
}

function PrintableHandover({ model }: { model: ExportModel }) {
  const h = model.handover;
  return (
    <div id="print-portal" className="print-portal">
      <h1>Handover: {h.leaver} → {h.successor} (CampusKart)</h1>
      <ul>{headerLines(model).map((l) => <li key={l}>{l}</li>)}</ul>
      <p><em>{GENERATED_LINE}</em></p>
      {!model.version && <p><strong>Draft.</strong> The reviewer has not approved or published this version.</p>}
      {model.sections.map((s, i) => (
        <section key={s.key}>
          <h2>{i + 1}. {s.title}</h2>
          {!s.claims.length && <p><em>Nothing visible to this role in this section.</em></p>}
          {s.claims.map((c) => (
            <div key={c.id} className="claim">
              <p><strong>[{STATE_LABEL[c.state]}]</strong> {c.statement}</p>
              <p className="meta">{[c.owner ? `Owner: ${c.owner}` : "", c.date ? `Date: ${c.date}` : "", c.confirmed_by ? `Confirmed by ${c.confirmed_by}` : ""].filter(Boolean).join(" · ")}</p>
              <ul>
                {c.citations.map((ci, k) => (
                  <li key={k}>{ci.url ? <>{ci.label} — {ci.source} ({ci.url})</> : <>{ci.source} ({ci.label})</>} — “{ci.quote}”{ci.support === "partial" ? " (partial support)" : ""}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
      {model.hidden_count > 0 && <p><em>{model.hidden_count} item{model.hidden_count > 1 ? "s were" : " was"} withheld by access level. Only the count is shown.</em></p>}
      <p className="foot">{GENERATED_LINE}</p>
    </div>
  );
}
