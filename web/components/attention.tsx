"use client";
// "What needs you now": one tile per to-do the API reports for this role (the same counts that drive the bell and
// the tab badges). A tile with work is highlighted and links to the right tab; a tile with nothing left says so.
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useNotifications } from "./shell";
import { useSession } from "@/lib/session";

const INTRO: Record<string, string> = {
  lead: "Decide, review, then publish the next version.",
  leaver: "Only what the evidence cannot answer.",
  contributor: "Read, acknowledge, and flag anything unclear.",
};

export function AttentionTiles({ hid }: { hid: string }) {
  const { role } = useSession();
  const items = useNotifications(role && role !== "guest" ? hid : null);
  if (!role || role === "guest" || items.length === 0) return null;
  const open = items.filter((i) => i.count > 0).length;
  return (
    <section aria-label="What needs you now" className="mb-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">What needs you now</h2>
        <p className="text-xs text-slate-500">{open === 0 ? "Everything is up to date." : INTRO[role]}</p>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((i) => {
          const todo = i.count > 0;
          return (
            <li key={i.key}>
              <Link
                href={`/handovers/${hid}/${i.tab}`}
                className={`group flex h-full min-h-[84px] flex-col justify-between rounded-lg border p-3 transition hover:shadow-sm ${todo ? "border-blue-300 bg-blue-50 hover:border-blue-500" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}
              >
                <span className="flex items-center justify-between">
                  <span className={`text-2xl font-bold leading-none ${todo ? "text-blue-900" : "text-slate-400"}`}>{i.count}</span>
                  {todo ? <ArrowRight size={14} className="text-blue-700 transition group-hover:translate-x-0.5" aria-hidden /> : <CheckCircle2 size={15} className="text-emerald-600" aria-hidden />}
                </span>
                <span className={`mt-2 text-xs leading-snug ${todo ? "font-medium text-slate-800" : "text-slate-600"}`}>{i.label}{!todo && <span className="sr-only"> (nothing to do)</span>}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
