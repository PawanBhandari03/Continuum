"""Real accounts (Improvement 3): Supabase Auth email magic links. The API never stores passwords; it asks Supabase
whether a bearer token is valid. Demo handovers (no members) keep the one-click demo roles; a handover with members
is private to them, the role comes from the membership (never from the client), and reads of the content tables run
as the signed-in user so Postgres row-level security filters them too."""
from __future__ import annotations
import contextvars
import os
import time

import httpx

user_ctx: contextvars.ContextVar[dict | None] = contextvars.ContextVar("continuum_user", default=None)
role_ctx: contextvars.ContextVar[str | None] = contextvars.ContextVar("continuum_member_role", default=None)

_tokens: dict[str, tuple[float, dict | None]] = {}


def verify_token(jwt: str) -> dict | None:
    """Returns {id, email, jwt} for a valid Supabase access token, else None. Cached for 5 minutes."""
    hit = _tokens.get(jwt)
    if hit and hit[0] > time.monotonic():
        return hit[1]
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")
    user = None
    if url and key:
        try:
            r = httpx.get(f"{url}/auth/v1/user", headers={"apikey": key, "Authorization": f"Bearer {jwt}"}, timeout=15)
            if r.status_code == 200:
                d = r.json()
                user = {"id": d["id"], "email": (d.get("email") or "").lower(), "jwt": jwt}
        except httpx.HTTPError:
            user = None
    _tokens[jwt] = (time.monotonic() + (300 if user else 30), user)
    return user


def public_config() -> dict:
    """What the browser needs to start a magic-link sign-in. Both values are public by design."""
    return {"supabase_url": os.environ.get("SUPABASE_URL", "").rstrip("/") or None,
            "publishable_key": os.environ.get("SUPABASE_PUBLISHABLE_KEY") or None}
