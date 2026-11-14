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
  missing: "border-l-[3.5px] border-l-[#d6ccbf] border-dashed",
  confirmed: "border-l-[3.5px] border-l-[#92a9e1]",
};

export function Statement({ claim }: { claim: Claim }) {
  if (claim.state === "inferred") {
    const rest = claim.statement.replace(new RegExp(`^${INFER}:?\\s*`), "");
    return (
      <p className="text-sm font-medium leading-relaxed text-[#25272d]">
        <span className="mr-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">{INFER}</span>
        {rest}
      </p>
    );
  }
  return <p className={`text-sm font-medium leading-relaxed ${claim.state === "missing" ? "italic text-[#575245]" : "text-[#25272d]"}`}>{claim.statement}</p>;
}

export function ClaimCard({ claim, actions, footer, showReview = false }: { claim: Claim; actions?: ReactNode; footer?: ReactNode; showReview?: boolean }) {
  const rejected = claim.review_status === "rejected" || claim.review_status === "superseded";
  const stateBorder = STATE_BORDER[claim.state] ?? "border-l-[#e5dfd6]";
  return (
    <article className={`rounded-xl border border-[#e5dfd6] bg-white p-4 shadow-2xs transition-all hover:shadow-md hover:border-[#b8c8ee] ${stateBorder} ${rejected ? "opacity-60" : ""} ${claim.label === "lead_only" ? "ring-1 ring-[#92a9e1]" : ""}`} data-claim-id={claim.id}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <StateBadge state={claim.state} />
        <span className="rounded-md border border-[#e5dfd6] bg-[#faf7f2] px-2 py-0.5 text-xs font-medium text-[#575245]">{TYPE_LABEL[claim.type]}</span>
        {claim.workstream && claim.workstream !== "general" && <span className="rounded-md bg-[#eef3fd] text-[#2b3e70] px-2 py-0.5 text-xs font-medium">#{claim.workstream}</span>}
        {claim.label === "lead_only" && <span className="inline-flex items-center gap-1 rounded-md border border-[#b8c8ee] bg-[#eef3fd] px-2 py-0.5 text-xs font-semibold text-[#2b3e70]"><Lock size={11} aria-hidden /> Lead only</span>}
        {claim.sensitive && <span className="rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-900">Sensitive</span>}
        {claim.method === "rules" && <span title="Found by deterministic rules, without AI" className="rounded border border-[#e5dfd6] bg-[#faf7f2] px-1.5 py-0.5 text-[11px] font-medium text-[#575245]">Rule</span>}
        {claim.method === "human" && <span title="Written or confirmed by a person" className="rounded border border-[#e5dfd6] bg-[#faf7f2] px-1.5 py-0.5 text-[11px] font-medium text-[#575245]">Human</span>}
        {showReview && <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${claim.review_status === "pending" ? "border border-[#e5dfd6] bg-[#faf7f2] text-[#575245]" : rejected ? "border border-rose-200 bg-rose-50 text-rose-700" : "border border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{REVIEW_LABEL[claim.review_status]}</span>}
      </div>
      <div className={rejected ? "line-through" : ""}><Statement claim={claim} /></div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#575245]">
        {claim.owner && <span>Owner: <b className="capitalize text-[#25272d]">{claim.owner}</b></span>}
        {claim.date && <span>{fmtDate(claim.date)}</span>}
        {claim.confirmed_by && <span>Confirmed by <b className="text-[#25272d]">{claim.confirmed_by}</b>{claim.confirmed_at ? ` · ${fmtDate(claim.confirmed_at)}` : ""}</span>}
      </div>
      <div className="mt-2.5"><SourceChips claim={claim} /></div>
      {claim.confidence_reason && <p className="mt-2 rounded-md bg-[#faf7f2] border border-[#e5dfd6] p-2 text-xs text-[#575245]">Why this state: {claim.confidence_reason}</p>}
      {actions && <div className="mt-3.5 flex flex-wrap gap-2 border-t border-[#e5dfd6] pt-2.5">{actions}</div>}
      {footer}
    </article>
  );
}
