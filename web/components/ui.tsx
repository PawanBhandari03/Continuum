"use client";
import type { ReactNode, ButtonHTMLAttributes } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CircleHelp,
  Lightbulb,
  ShieldCheck,
  FileText,
  GitPullRequest,
  MessageSquare,
  NotebookText,
  ListChecks,
  Mic,
  type LucideIcon,
} from "lucide-react";
import type { AccessLabel, EvidenceState, SourceStatus, SourceType } from "@/lib/types";

// ---- Evidence state badge: icon + text + colour (never colour only) ----
const STATE: Record<EvidenceState, { label: string; icon: LucideIcon; cls: string; tip: string }> = {
  verified: { label: "Verified", icon: BadgeCheck, cls: "bg-emerald-50 text-emerald-900 border-emerald-300", tip: "A source states this directly and an automated check confirmed the source supports it." },
  inferred: { label: "Inferred", icon: Lightbulb, cls: "bg-amber-50 text-amber-900 border-amber-300 border-dashed", tip: "AI inference — not stated in any source." },
  conflicting: { label: "Conflicting", icon: AlertTriangle, cls: "bg-rose-50 text-rose-900 border-rose-300", tip: "Sources disagree. Both are shown; neither is assumed correct." },
  missing: { label: "Missing", icon: CircleHelp, cls: "bg-slate-100 text-slate-800 border-slate-400 border-dashed", tip: "A handover needs this but no evidence was found. Listed for the Gap Interview." },
  confirmed: { label: "Confirmed", icon: ShieldCheck, cls: "bg-indigo-50 text-indigo-900 border-indigo-300", tip: "A human reviewer (or the leaver) confirmed or corrected this." },
};
export function StateBadge({ state }: { state: EvidenceState }) {
  const s = STATE[state];
  const Icon = s.icon;
  return (
    <span title={s.tip} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${s.cls}`}>
      <Icon size={13} aria-hidden /> {s.label}
    </span>
  );
}
export const STATE_LABELS = STATE;

const SRC_ICON: Record<SourceType, LucideIcon> = { github: GitPullRequest, chat_export: MessageSquare, notes: NotebookText, issues: ListChecks, exit_qa: Mic };
export const sourceIcon = (t: SourceType) => SRC_ICON[t] ?? FileText;

export function SourceStatusChip({ status, reason }: { status: SourceStatus; reason?: string | null }) {
  const m: Record<SourceStatus, string> = {
    ok: "bg-emerald-50 text-emerald-900 border-emerald-300",
    partial: "bg-amber-50 text-amber-900 border-amber-400",
    failed: "bg-rose-50 text-rose-900 border-rose-300",
    pending: "bg-slate-100 text-slate-700 border-slate-300",
  };
  const t: Record<SourceStatus, string> = { ok: "OK", partial: "Partial", failed: "Failed", pending: "Pending" };
  return (
    <span title={reason ?? undefined} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${m[status]}`}>
      {t[status]}
    </span>
  );
}

export function LabelTag({ label }: { label: AccessLabel }) {
  const m: Record<AccessLabel, string> = { public: "Public", contributor: "Contributor", lead_only: "Lead only" };
  return (
    <span className={`inline-flex rounded border px-1.5 py-0.5 text-[11px] font-medium ${label === "lead_only" ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-900" : "border-slate-300 bg-slate-50 text-slate-700"}`}>
      {m[label]}
    </span>
  );
}

export function Button({ variant = "secondary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const v = {
    primary: "bg-indigo-700 text-white hover:bg-indigo-800 disabled:bg-slate-300 disabled:text-slate-500",
    secondary: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 disabled:text-slate-400",
    danger: "border border-rose-300 bg-white text-rose-800 hover:bg-rose-50 disabled:text-slate-400",
    ghost: "text-slate-700 hover:bg-slate-100 disabled:text-slate-400",
  }[variant];
  return <button {...p} className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed ${v} ${className}`} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</section>;
}

export function PageTitle({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {sub && <p className="mt-1 max-w-3xl text-sm text-slate-600">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error"; children: ReactNode }) {
  const m = { info: "border-sky-200 bg-sky-50 text-sky-900", warn: "border-amber-300 bg-amber-50 text-amber-900", error: "border-rose-300 bg-rose-50 text-rose-900" }[tone];
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${m}`}>{children}</div>;
}

export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
export const fmtDateTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
