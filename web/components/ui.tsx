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
  verified: { label: "Verified", icon: BadgeCheck, cls: "bg-emerald-50/90 text-emerald-950 border-emerald-300 shadow-xs shadow-emerald-500/10", tip: "A source states this directly and an automated check confirmed the source supports it." },
  inferred: { label: "Inferred", icon: Lightbulb, cls: "bg-amber-50/90 text-amber-950 border-amber-300 border-dashed shadow-xs shadow-amber-500/10", tip: "AI inference — not stated in any source." },
  conflicting: { label: "Conflicting", icon: AlertTriangle, cls: "bg-rose-50/90 text-rose-950 border-rose-300 shadow-xs shadow-rose-500/10", tip: "Sources disagree. Both are shown; neither is assumed correct." },
  missing: { label: "Missing", icon: CircleHelp, cls: "bg-[#faf7f2] text-[#25272d] border-[#d6ccbf] border-dashed", tip: "A handover needs this but no evidence was found. Listed for the Gap Interview." },
  confirmed: { label: "Confirmed", icon: ShieldCheck, cls: "bg-[#eef3fd] text-[#253966] border-[#b8c8ee] shadow-xs shadow-[#92a9e1]/10", tip: "A human reviewer (or the leaver) confirmed or corrected this." },
};
export function StateBadge({ state }: { state: EvidenceState }) {
  const s = STATE[state];
  const Icon = s.icon;
  return (
    <span title={s.tip} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-transform hover:scale-105 ${s.cls}`}>
      <Icon size={13} className="shrink-0" aria-hidden /> {s.label}
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
    pending: "bg-[#faf7f2] text-[#575245] border-[#d6ccbf]",
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
    <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${label === "lead_only" ? "border-[#b8c8ee] bg-[#eef3fd] text-[#2b3e70]" : "border-[#d6ccbf] bg-[#faf7f2] text-[#575245]"}`}>
      {m[label]}
    </span>
  );
}

export function Button({ variant = "secondary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const v = {
    primary: "bg-[#25272d] text-white shadow-xs hover:bg-[#191b1f] active:scale-[0.98] disabled:bg-[#ded8cd] disabled:text-[#6b6455] disabled:opacity-60 disabled:shadow-none focus-visible:outline-[#92a9e1]",
    secondary: "border border-[#d6ccbf] bg-white text-[#25272d] shadow-2xs hover:border-[#92a9e1] hover:bg-[#faf7f2] active:scale-[0.98] disabled:text-[#6b6455]",
    danger: "border border-rose-300 bg-white text-rose-800 shadow-2xs hover:bg-rose-50 hover:border-rose-400 active:scale-[0.98] disabled:text-[#6b6455]",
    ghost: "text-[#25272d] hover:bg-[#eef3fd] hover:text-[#25272d] active:scale-[0.98] disabled:text-[#6b6455]",
  }[variant];
  return <button {...p} className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-1.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#92a9e1] disabled:cursor-not-allowed ${v} ${className}`} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-[#e5dfd6] bg-white p-5 shadow-2xs transition hover:shadow-sm hover:border-[#b8c8ee] ${className}`}>{children}</section>;
}

export function PageTitle({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#25272d] sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-[#575245]">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error"; children: ReactNode }) {
  const m = {
    info: "border-[#b8c8ee] bg-[#eef3fd] text-[#253966] shadow-2xs",
    warn: "border-amber-300 bg-amber-50/80 text-amber-900 shadow-2xs",
    error: "border-rose-300 bg-rose-50/80 text-rose-900 shadow-2xs"
  }[tone];
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-3.5 py-2.5 text-sm ${m}`}>{children}</div>;
}

export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
export const fmtDateTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
