"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { EyeOff, KeyRound, Lock, ShieldAlert, UserX } from "lucide-react";
import { api } from "@/lib/api";
import type { PrivacyItem } from "@/lib/types";
import { Button, Card, Notice, PageTitle, fmtDate, fmtDateTime } from "@/components/ui";
import { HandoverNav, RoleGuard, notifyChanged } from "@/components/shell";
import { EmptyState, LoadError, SkeletonList } from "@/components/feedback";
import { friendlyError } from "@/lib/status";

const DECISION: Record<PrivacyItem["decision"], string> = {
  pending: "Needs your decision", keep_masked: "Kept masked", unmask: "Not sensitive", escalate_lead_only: "Made lead-only", added_manual: "Masked by a reviewer",
};

/** Highlight the masked placeholders in a preview so the reviewer sees exactly what is hidden. */
function Preview({ text }: { text: string }) {
  const parts = text.split(/(\[REDACTED [A-Z]+\])/g);
  return (
    <p className="rounded-md bg-slate-50 p-2 font-mono text-[13px] leading-relaxed text-slate-900">
      {parts.map((p, i) => /^\[REDACTED/.test(p)
        ? <span key={i} className="mx-0.5 rounded bg-slate-800 px-1 text-[11px] font-semibold text-white">{p.slice(1, -1).replace("REDACTED ", "masked ").toLowerCase()}</span>
        : <span key={i}>{p}</span>)}
    </p>
  );
}

export default function PrivacyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [items, setItems] = useState<PrivacyItem[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      setItems((await api.getPrivacy(id)).items);
    } catch (e) {
      setLoadErr(friendlyError(e));
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  const counts = useMemo(() => ({
    secrets: (items ?? []).filter((i) => i.kind === "secret").length,
    personal: (items ?? []).filter((i) => i.kind === "pii").length,
    people: (items ?? []).filter((i) => i.kind === "suggestion").length,
    pending: (items ?? []).filter((i) => i.decision === "pending").length,
  }), [items]);
  const shown = (items ?? []).filter((i) => filter === "all" || i.decision === "pending");
  const bySource = shown.reduce<Record<string, PrivacyItem[]>>((acc, i) => {
    (acc[i.source_name ?? "Unknown source"] ??= []).push(i);
    return acc;
  }, {});

  return (
    <RoleGuard hid={id} allow={["lead"]}>
      <HandoverNav hid={id} />
      <PageTitle
        title="Privacy review"
        sub="Everything Continuum masked before any AI or successor saw it, plus remarks about people that should not reach a successor by default. Raw values never leave the server, not even to you. Remarks about people block publishing until you decide."
      />
      {loadErr && <LoadError message={loadErr} onRetry={load} />}
      {!items && !loadErr && <SkeletonList rows={3} label="Loading privacy items" />}
      {items && (
        <div className="mb-5 grid gap-3 sm:grid-cols-4">
          <Stat icon={KeyRound} n={counts.secrets} label="Secrets masked (keys, tokens)" />
          <Stat icon={EyeOff} n={counts.personal} label="Personal data masked (UPI, PAN, Aadhaar, email, phone)" />
          <Stat icon={UserX} n={counts.people} label="Remarks about people" />
          <Stat icon={ShieldAlert} n={counts.pending} label="Waiting for your decision" tone={counts.pending ? "warn" : "ok"} />
        </div>
      )}
      {items && (
        <div className="mb-4 flex gap-2 text-sm" role="group" aria-label="Show">
          <Button variant={filter === "pending" ? "primary" : "secondary"} onClick={() => setFilter("pending")}>Needs a decision ({counts.pending})</Button>
          <Button variant={filter === "all" ? "primary" : "secondary"} onClick={() => setFilter("all")}>Everything ({items.length})</Button>
        </div>
      )}
      {items && shown.length === 0 && <EmptyState title={filter === "pending" ? "Nothing waiting for a decision" : "Nothing was masked"} hint={filter === "pending" ? "Switch to “Everything” to see what was masked automatically." : undefined} />}
      <div className="space-y-6">
        {Object.entries(bySource).map(([src, list]) => (
          <section key={src} aria-label={src}>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">{src}</h2>
            <div className="space-y-3">{list.map((i) => <ItemCard key={i.id} item={i} onChanged={load} />)}</div>
          </section>
        ))}
      </div>
    </RoleGuard>
  );
}

function Stat({ icon: Icon, n, label, tone }: { icon: typeof Lock; n: number; label: string; tone?: "warn" | "ok" }) {
  return (
    <div className={`rounded-xl border p-3 ${tone === "warn" ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-center gap-2"><Icon size={16} aria-hidden className="text-slate-600" /><span className="text-2xl font-bold">{n}</span></div>
      <p className="mt-1 text-xs text-slate-600">{label}</p>
    </div>
  );
}

function ItemCard({ item: i, onChanged }: { item: PrivacyItem; onChanged: () => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function decide(decision: "keep_masked" | "unmask" | "escalate_lead_only" | "dismiss") {
    setBusy(true);
    setErr(null);
    try {
      await api.decidePrivacy(i.id, { decision, reason });
      notifyChanged();
      await onChanged();
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  const pending = i.decision === "pending";
  const needReason = reason.trim().length < 5;
  return (
    <Card className={pending ? "border-amber-300" : ""}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full border px-2 py-0.5 font-semibold ${i.kind === "secret" ? "border-rose-300 bg-rose-50 text-rose-900" : i.kind === "suggestion" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-300 bg-slate-50 text-slate-800"}`}>{i.detector_name}</span>
        <span className="text-slate-500">{i.author} · {fmtDate(i.ts)} · readable by {i.label === "lead_only" ? "the lead only" : i.label === "public" ? "everyone" : "contributors"}</span>
        <span className={`ml-auto font-semibold ${pending ? "text-amber-800" : "text-emerald-800"}`}>{DECISION[i.decision]}</span>
      </div>
      <div className="mt-2"><Preview text={i.preview} /></div>
      {i.kind === "suggestion" && <p className="mt-1 text-xs text-slate-600">This passage judges a person (performance, health or discipline). It is not masked yet: decide whether a successor should read it.</p>}
      {!pending && i.decided_by && <p className="mt-2 text-xs text-slate-600">Decided by {i.decided_by} · {fmtDateTime(i.decided_at)}{i.reason ? ` · “${i.reason}”` : ""}</p>}
      {pending && (
        <div className="mt-3 space-y-2">
          <input aria-label="Reason" className="w-full rounded-md border border-slate-300 p-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required for anything but “keep masked”)" />
          <div className="flex flex-wrap gap-2">
            {i.kind !== "suggestion" && <Button disabled={busy} onClick={() => decide("keep_masked")}><Lock size={14} aria-hidden /> Keep masked</Button>}
            {i.kind === "pii" && <Button disabled={busy || needReason} onClick={() => decide("unmask")}>Not sensitive: unmask</Button>}
            {i.kind === "suggestion" && <Button disabled={busy || needReason} onClick={() => decide("dismiss")}>Fine for a successor to read</Button>}
            <Button variant="primary" disabled={busy || needReason} onClick={() => decide("escalate_lead_only")}><ShieldAlert size={14} aria-hidden /> Make this passage lead-only</Button>
          </div>
          {i.kind === "secret" && <p className="text-xs text-slate-500">Secrets can never be unmasked. Only “keep masked” or “lead-only” are possible.</p>}
          {err && <Notice tone="error">{err}</Notice>}
        </div>
      )}
    </Card>
  );
}
