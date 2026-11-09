// Tiny external store: is the API currently "waking up" (a request is being retried)?
// Read with useSyncExternalStore in the ServerBanner; written by the HTTP layer in api.ts.
let count = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const subscribeWaking = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export const getWaking = () => count > 0;

/** Mark one request as waiting on a sleeping server. Returns an idempotent "done" function. */
export function beginWaking(): () => void {
  let done = false;
  count++;
  emit();
  return () => {
    if (done) return;
    done = true;
    count--;
    emit();
  };
}

/** Turn any thrown value into a short, readable message (never a stack trace or raw JSON). */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (/could not reach|failed to fetch|networkerror|load failed|aborted|timeout|server not ready/i.test(msg))
    return "We couldn't reach the server. It may be waking up (free hosting sleeps after about 15 minutes of no use). Please retry in a moment.";
  if (/^\s*[{[]/.test(msg)) return "Something went wrong on the server. Please retry; if it keeps happening, tell the team.";
  if (!msg) return "Something went wrong. Please retry.";
  return msg.length > 240 ? `${msg.slice(0, 240)}…` : msg;
}
