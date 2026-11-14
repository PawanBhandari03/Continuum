// Real accounts: Supabase Auth email magic links over its REST API (no extra library, no passwords stored by us).
// The browser holds the access token; the Continuum API verifies it with Supabase on every request.
const KEY = "continuum-auth";
const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
  email: string;
}
interface Cfg {
  supabase_url: string | null;
  publishable_key: string | null;
}

let cfg: Cfg | null = null;
async function config(): Promise<Cfg> {
  if (cfg) return cfg;
  const r = await fetch(`${API_URL}/auth/config`);
  cfg = (await r.json()) as Cfg;
  return cfg;
}

export function getSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}
function save(s: AuthSession | null) {
  try {
    if (s) window.localStorage.setItem(KEY, JSON.stringify(s));
    else window.localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event("continuum:auth"));
}

/** Email a one-time sign-in link. The link brings the person back to /signin on this site. */
export async function sendMagicLink(email: string): Promise<void> {
  const c = await config();
  if (!c.supabase_url || !c.publishable_key) throw new Error("Sign-in is not configured on this server.");
  const r = await fetch(`${c.supabase_url}/auth/v1/otp`, {
    method: "POST",
    headers: { apikey: c.publishable_key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, create_user: true, options: { emailRedirectTo: `${window.location.origin}/signin` }, gotrue_meta_security: {} }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.msg || d.error_description || d.message || "Could not send the sign-in email. Please try again in a minute.");
  }
}

/** Call on /signin: turns the #access_token fragment of the magic link into a stored session. */
export async function completeSignIn(): Promise<AuthSession | null> {
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const err = h.get("error_description");
  if (err) throw new Error(err.replace(/\+/g, " "));
  const access = h.get("access_token");
  const refresh = h.get("refresh_token");
  if (!access || !refresh) return null;
  const c = await config();
  const r = await fetch(`${c.supabase_url}/auth/v1/user`, { headers: { apikey: c.publishable_key!, Authorization: `Bearer ${access}` } });
  if (!r.ok) throw new Error("This sign-in link is invalid or has expired. Please request a new one.");
  const u = await r.json();
  const s: AuthSession = {
    access_token: access,
    refresh_token: refresh,
    expires_at: Math.floor(Date.now() / 1000) + Number(h.get("expires_in") ?? 3600),
    email: (u.email as string).toLowerCase(),
  };
  save(s);
  window.history.replaceState(null, "", window.location.pathname);
  return s;
}

let refreshing: Promise<AuthSession | null> | null = null;
/** A valid access token (refreshed when it is about to expire), or null when signed out. */
export async function accessToken(): Promise<string | null> {
  const s = getSession();
  if (!s) return null;
  if (s.expires_at - 60 > Date.now() / 1000) return s.access_token;
  refreshing ??= (async () => {
    try {
      const c = await config();
      const r = await fetch(`${c.supabase_url}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { apikey: c.publishable_key!, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: s.refresh_token }),
      });
      if (!r.ok) {
        save(null);
        return null;
      }
      const d = await r.json();
      const next: AuthSession = { ...s, access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Math.floor(Date.now() / 1000) + Number(d.expires_in ?? 3600) };
      save(next);
      return next;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return (await refreshing)?.access_token ?? null;
}

export function signOut() {
  save(null);
}
