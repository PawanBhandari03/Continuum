"use client";
// "What needs you now": one tile per to-do the API reports for this role (the same counts that drive the bell and
// the tab badges). A tile with work is highlighted and links to the right tab; a tile with nothing left says so.
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useNotifications } from "./shell";
import { useSession } from "@/lib/session";
import { UserAvatar } from "./avatar";

const INTRO: Record<string, string> = {
  lead: "Lead Reviewer: decide, review, then sign & publish the next version.",
  leaver: "Departing Engineer: answer only what the evidence cannot answer.",
  contributor: "Successor Engineer: read, acknowledge, and flag anything unclear.",
};

const ROLE_NAME: Record<string, string> = {
  lead: "Project Lead",
  leaver: "Aditi Rao",
  contributor: "Karan Verma",
};

export function AttentionTiles({ hid }: { hid: string }) {
  const { role } = useSession();
  const items = useNotifications(role && role !== "guest" ? hid : null);
  if (!role || role === "guest" || items.length === 0) return null;
  const open = items.filter((i) => i.count > 0).length;
  const userName = ROLE_NAME[role] ?? "Team Member";
  return (
    <section aria-label="What needs you now" className="mb-6">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#25272d]">
          <UserAvatar name={userName} role={role} size={20} />
          <span>What needs {userName} now</span>
        </h2>
        <p className="text-xs font-medium text-[#575245]">{open === 0 ? "Everything is up to date." : INTRO[role]}</p>
      </div>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((i) => {
          const todo = i.count > 0;
          return (
            <li key={i.key}>
              <Link
                href={`/handovers/${hid}/${i.tab}`}
                className={`group flex h-full min-h-[90px] flex-col justify-between rounded-xl border p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 ${todo ? "border-[#b8c8ee] bg-[#eef3fd] shadow-xs hover:border-[#92a9e1]" : "border-[#e5dfd6] bg-white text-[#898170] hover:border-[#d6ccbf]"}`}
              >
                <span className="flex items-center justify-between">
                  <span className={`text-2xl font-extrabold tracking-tight ${todo ? "text-[#25272d]" : "text-[#c0b8a9]"}`}>{i.count}</span>
                  {todo ? <ArrowRight size={15} className="text-[#2b3e70] transition group-hover:translate-x-1" aria-hidden /> : <CheckCircle2 size={16} className="text-emerald-600" aria-hidden />}
                </span>
                <span className={`mt-2 text-xs leading-snug ${todo ? "font-semibold text-[#25272d]" : "text-[#575245]"}`}>{i.label}{!todo && <span className="sr-only"> (nothing to do)</span>}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
