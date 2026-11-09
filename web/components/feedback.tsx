"use client";
import { useSyncExternalStore } from "react";
import { Inbox, Loader2, RefreshCw } from "lucide-react";
import { getWaking, subscribeWaking } from "@/lib/status";
import { Button } from "./ui";

/** Banner shown while a request is being retried because the free-tier server is asleep. */
export function ServerBanner() {
  const waking = useSyncExternalStore(subscribeWaking, getWaking, () => false);
  if (!waking) return null;
  return (
    <div role="status" aria-live="polite" className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-center text-sm text-sky-900">
      <Loader2 className="mr-1.5 inline animate-spin" size={14} aria-hidden />
      Waking the server, this can take up to a minute… Your screen will fill in by itself.
    </div>
  );
}

/** Friendly load failure with a Retry button. Never shows a stack trace. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
      <p className="font-medium">This didn&apos;t load.</p>
      <p className="mt-0.5">{message}</p>
      <Button className="mt-2" onClick={onRetry}><RefreshCw size={14} aria-hidden /> Retry</Button>
    </div>
  );
}

export function SkeletonList({ rows = 3, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-2.5">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-slate-200 bg-white p-3" aria-hidden>
          <div className="mb-2 h-4 w-24 rounded bg-slate-200" />
          <div className="mb-1.5 h-3 w-full rounded bg-slate-100" />
          <div className="h-3 w-2/3 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
      <Inbox className="mx-auto mb-2 text-slate-400" size={22} aria-hidden />
      <p className="font-medium text-slate-800">{title}</p>
      {hint && <p className="mt-1">{hint}</p>}
    </div>
  );
}
