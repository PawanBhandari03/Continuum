"use client";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import type { Claim } from "@/lib/types";
import { SourceChips } from "./evidence";
import { StateBadge, fmtDate } from "./ui";

const TYPE_LABEL: Record<Claim["type"], string> = {
  decision: "Decision", risk: "Risk", dependency: "Dependency", owner: "Owner", next_action: "Next action", open_question: "Open question", fact: "Fact", gap: "Gap",
};
const INFER = "AI inference — not stated in any source";
const REVIEW_LABEL: Record<Claim["review_status"], string> = { pending: "Not reviewed", approved: "Approved", edited: "Edited", rejected: "Rejected", redacted: "Redacted", superseded: "Superseded by a conflict decision" };

export function Statement({ claim }: { claim: Claim }) {
  if (claim.state === "inferred") {
    const rest = claim.statement.replace(new RegExp(`^${INFER}:?\\s*`), "");
    return (
      <p className="text-sm text-slate-900">
        <span className="mr-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold italic text-amber-900">{INFER}</span>
        {rest}
      </p>
    );
  }
  return <p className={`text-sm ${claim.state === "missing" ? "italic text-slate-800" : "text-slate-900"}`}>{claim.statement}</p>;
}

export function ClaimCard({ claim, actions, footer, showReview = false }: { claim: Claim; actions?: ReactNode; footer?: ReactNode; showReview?: boolean }) {
  const rejected = claim.review_status === "rejected" || claim.review_status === "superseded";
  return (
    <article className={`rounded-lg border bg-white p-3 ${rejected ? "border-slate-200 opacity-60" : "border-slate-200"} ${claim.label === "lead_only" ? "ring-1 ring-teal-200" : ""}`} data-claim-id={claim.id}>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <StateBadge state={claim.state} />
        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-700">{TYPE_LABEL[claim.type]}</span>
        {claim.workstream && claim.workstream !== "general" && <span className="text-xs text-slate-500">#{claim.workstream}</span>}
        {claim.label === "lead_only" && <span className="inline-flex items-center gap-1 rounded border border-teal-300 bg-teal-50 px-1.5 py-0.5 text-xs font-medium text-teal-900"><Lock size={11} aria-hidden /> Lead only</span>}
        {claim.sensitive && <span className="rounded border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-xs font-medium text-rose-900">Sensitive</span>}
        {claim.method === "rules" && <span title="Found by deterministic rules, without AI" className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600">Rule</span>}
        {claim.method === "human" && <span title="Written or confirmed by a person" className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600">Human</span>}
        {showReview && <span className={`ml-auto text-xs font-medium ${claim.review_status === "pending" ? "text-slate-500" : rejected ? "text-rose-700" : "text-emerald-800"}`}>{REVIEW_LABEL[claim.review_status]}</span>}
      </div>
      <div className={rejected ? "line-through" : ""}><Statement claim={claim} /></div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
        {claim.owner && <span>Owner: <b className="capitalize text-slate-800">{claim.owner}</b></span>}
        {claim.date && <span>{fmtDate(claim.date)}</span>}
        {claim.confirmed_by && <span>Confirmed by <b>{claim.confirmed_by}</b>{claim.confirmed_at ? ` · ${fmtDate(claim.confirmed_at)}` : ""}</span>}
      </div>
      <div className="mt-2"><SourceChips claim={claim} /></div>
      {claim.confidence_reason && <p className="mt-2 text-xs text-slate-500">Why this state: {claim.confidence_reason}</p>}
      {actions && <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">{actions}</div>}
      {footer}
    </article>
  );
}
