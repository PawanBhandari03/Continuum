"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LockKeyhole, LogOut, Mail } from "lucide-react";
import { api } from "@/lib/api";
import { completeSignIn, getSession, sendMagicLink, signOut, type AuthSession } from "@/lib/auth";
import { ROLE_META, useSession } from "@/lib/session";
import type { Handover, Role } from "@/lib/types";
import { Button, Card, Notice, PageTitle, fmtDate } from "@/components/ui";
import { friendlyError } from "@/lib/status";

/** Real accounts. The judge demo never needs this page: it is for people running their own private handovers. */
export default function SignInPage() {
  const router = useRouter();
  const { setRole } = useSession();
  const [sess, setSess] = useState<AuthSession | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mine, setMine] = useState<(Handover & { my_role: Role })[] | null>(null);

  const loadMine = useCallback(async () => {
    try {
      setMine((await api.getMe()).handovers);
    } catch (e) {
      setErr(friendlyError(e));
    }
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const s = (await completeSignIn()) ?? getSession();
        setSess(s);
        if (s) await loadMine();
      } catch (e) {
        setErr(friendlyError(e));
      }
    })();
  }, [loadMine]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await sendMagicLink(email.trim());
      setSent(true);
    } catch (x) {
      setErr(friendlyError(x));
    } finally {
      setBusy(false);
    }
  }
  const input = "mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm";

  return (
    <>
      <PageTitle
        title="Sign in"
        sub="For your own, private handovers. Sign in with an email link (no password). The people you invite see only what their role allows, and the database enforces it. The judge demo does not need this: it works without signing in."
      />
      {err && <div className="mb-3"><Notice tone="error">{err}</Notice></div>}
      {!sess && (
        <Card className="max-w-md">
          {sent ? (
            <p className="text-sm text-slate-800" role="status"><Mail size={16} className="mr-1 inline" aria-hidden /> We sent a sign-in link to <b>{email}</b>. Open it on this device. It works once and expires after a short time. Check spam if it does not arrive within a minute.</p>
          ) : (
            <form onSubmit={send} className="space-y-3 text-sm">
              <label className="block font-medium">Your email
                <input required type="email" autoComplete="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </label>
              <Button variant="primary" type="submit" disabled={busy}><LockKeyhole size={14} aria-hidden /> {busy ? "Sending…" : "Email me a sign-in link"}</Button>
              <p className="text-xs text-slate-500">If someone invited you to a handover, use the same email address they invited.</p>
            </form>
          )}
        </Card>
      )}
      {sess && (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">Signed in as <b>{sess.email}</b></p>
            <div className="flex gap-2">
              <Link href="/handovers" className="inline-flex items-center rounded-md bg-indigo-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-800">Create a private handover</Link>
              <Button onClick={() => { signOut(); setSess(null); setMine(null); }}><LogOut size={14} aria-hidden /> Sign out</Button>
            </div>
          </Card>
          <h2 className="text-lg font-semibold">Your handovers</h2>
          {!mine && <p className="text-sm text-slate-600">Loading…</p>}
          {mine?.length === 0 && <p className="text-sm text-slate-600">None yet. Create one, or ask a lead to invite {sess.email}.</p>}
          {mine?.map((h) => (
            <Card key={h.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold capitalize">{h.leaver} → {h.successor}</p>
                <p className="text-sm text-slate-600">Your role: <b>{ROLE_META[h.my_role].label}</b> · {h.version ? `published v${h.version}` : "not published yet"} · target {fmtDate(h.target_date)}</p>
              </div>
              <Button variant="primary" onClick={() => { setRole(h.my_role); router.push(ROLE_META[h.my_role].home(h.id)); }}>Open</Button>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
