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

const STATE_BORDER: Record<Claim["state"], string> = {
  verified: "border-l-[3.5px] border-l-emerald-600",
  inferred: "border-l-[3.5px] border-l-amber-500",
  conflicting: "border-l-[3.5px] border-l-rose-500",
  missing: "border-l-[3.5px] border-l-[#c8d2e8] border-dashed",
  confirmed: "border-l-[3.5px] border-l-[#7b9bf0]",
};

export function Statement({ claim }: { claim: Claim }) {
  if (claim.state === "inferred") {
    const rest = claim.statement.replace(new RegExp(`^${INFER}:?\\s*`), "");
    return (
      <p className="text-sm font-medium leading-relaxed text-[#0f1b3a]">
        <span className="mr-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">{INFER}</span>
        {rest}
      </p>
    );
  }
  return <p className={`text-sm font-medium leading-relaxed ${claim.state === "missing" ? "italic text-[#455272]" : "text-[#0f1b3a]"}`}>{claim.statement}</p>;
}

export function ClaimCard({ claim, actions, footer, showReview = false }: { claim: Claim; actions?: ReactNode; footer?: ReactNode; showReview?: boolean }) {
  const rejected = claim.review_status === "rejected" || claim.review_status === "superseded";
  const stateBorder = STATE_BORDER[claim.state] ?? "border-l-[#dce3f1]";
  return (
    <article className={`rounded-xl border border-[#dce3f1] bg-white p-4 shadow-2xs transition-all hover:shadow-md hover:border-[#b7c7f5] ${stateBorder} ${rejected ? "opacity-60" : ""} ${claim.label === "lead_only" ? "ring-1 ring-[#7b9bf0]" : ""}`} data-claim-id={claim.id}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <StateBadge state={claim.state} />
        <span className="rounded-md border border-[#dce3f1] bg-[#f6f8fd] px-2 py-0.5 text-xs font-medium text-[#455272]">{TYPE_LABEL[claim.type]}</span>
        {claim.workstream && claim.workstream !== "general" && <span className="rounded-md bg-[#e9efff] text-[#1d3a9e] px-2 py-0.5 text-xs font-medium">#{claim.workstream}</span>}
        {claim.label === "lead_only" && <span className="inline-flex items-center gap-1 rounded-md border border-[#b7c7f5] bg-[#e9efff] px-2 py-0.5 text-xs font-semibold text-[#1d3a9e]"><Lock size={11} aria-hidden /> Lead only</span>}
        {claim.sensitive && <span className="rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-900">Sensitive</span>}
        {claim.method === "rules" && <span title="Found by deterministic rules, without AI" className="rounded border border-[#dce3f1] bg-[#f6f8fd] px-1.5 py-0.5 text-[11px] font-medium text-[#455272]">Rule</span>}
        {claim.method === "human" && <span title="Written or confirmed by a person" className="rounded border border-[#dce3f1] bg-[#f6f8fd] px-1.5 py-0.5 text-[11px] font-medium text-[#455272]">Human</span>}
        {showReview && <span className={`ml-auto whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${claim.review_status === "pending" ? "border border-[#dce3f1] bg-[#f6f8fd] text-[#455272]" : rejected ? "border border-rose-200 bg-rose-50 text-rose-700" : "border border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{REVIEW_LABEL[claim.review_status]}</span>}
      </div>
      <div className={rejected ? "line-through" : ""}><Statement claim={claim} /></div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#455272]">
        {claim.owner && <span>Owner: <b className="capitalize text-[#0f1b3a]">{claim.owner}</b></span>}
        {claim.date && <span>{fmtDate(claim.date)}</span>}
        {claim.confirmed_by && <span>Confirmed by <b className="text-[#0f1b3a]">{claim.confirmed_by}</b>{claim.confirmed_at ? ` · ${fmtDate(claim.confirmed_at)}` : ""}</span>}
      </div>
      <div className="mt-2.5"><SourceChips claim={claim} /></div>
      {claim.confidence_reason && <p className="mt-2 rounded-md bg-[#f6f8fd] border border-[#dce3f1] p-2 text-xs text-[#455272]">Why this state: {claim.confidence_reason}</p>}
      {actions && <div className="mt-3.5 flex flex-wrap gap-2 border-t border-[#dce3f1] pt-2.5">{actions}</div>}
      {footer}
    </article>
  );
}
