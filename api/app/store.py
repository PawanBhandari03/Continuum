"""Supabase (PostgREST) data access using the service key. User-facing permission
decisions are made in visibility.py; row-level security in the database is the second layer
(and protects direct access with user JWTs)."""
from __future__ import annotations
import os
from typing import Any

import httpx

from . import config  # noqa: F401  (loads .env)


class StoreError(RuntimeError):
    pass


# Short-lived read cache shared by all stores. Any write (insert, update, delete, rpc) bumps the version, which
# invalidates every cached read at once, so a page that asks for the same rows from several endpoints pays the
# network round trip to the database once. All writes go through this API process, so nothing can go stale
# except through another tool writing directly (hence the 20 s ceiling).
_WVER = 0
_RC: dict = {}
_RC_TTL = 20.0
_RC_MAX = 400


def _bump() -> None:
    global _WVER
    _WVER += 1
    if len(_RC) > _RC_MAX:
        _RC.clear()


class Store:
    def __init__(self, user_jwt: str | None = None) -> None:
        """Service store by default. With `user_jwt`, requests run AS that signed-in user (publishable key +
        their token), so the database's row-level-security policies decide what comes back."""
        self.url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        key = os.environ.get("SUPABASE_PUBLISHABLE_KEY" if user_jwt else "SUPABASE_SECRET_KEY", "")
        if not self.url or not key:
            raise StoreError("SUPABASE_URL / SUPABASE keys not configured")
        import hashlib
        self.tag = "u:" + hashlib.sha256(user_jwt.encode()).hexdigest()[:12] if user_jwt else "svc"
        headers = {"apikey": key, "Content-Type": "application/json"}
        if user_jwt:
            headers["Authorization"] = f"Bearer {user_jwt}"
        self.http = httpx.Client(timeout=30, headers=headers)

    def _req(self, method: str, table: str, params: dict | None = None, json: Any = None,
             prefer: str | None = None) -> httpx.Response:
        headers = {"Prefer": prefer} if prefer else {}
        last = None
        for _ in range(3):
            try:
                r = self.http.request(method, f"{self.url}/rest/v1/{table}", params=params, json=json, headers=headers)
            except httpx.HTTPError as e:
                last = e
                continue
            if r.status_code >= 400:
                raise StoreError(f"{method} {table}: HTTP {r.status_code} {r.text[:300]}")
            return r
        raise StoreError(f"{method} {table}: network error {type(last).__name__}")

    @staticmethod
    def _eq(match: dict) -> dict:
        return {k: (v if isinstance(v, str) and v.startswith(("in.", "eq.", "neq.", "is.", "lt.", "gt.")) else f"eq.{v}")
                for k, v in match.items()}

    def sel(self, table: str, match: dict | None = None, select: str = "*", order: str | None = None,
            limit: int | None = None) -> list[dict]:
        import copy
        import time
        key = (self.tag, table, tuple(sorted((k, str(v)) for k, v in (match or {}).items())), select, order, limit)
        hit = _RC.get(key)
        if hit and hit[0] == _WVER and hit[1] > time.monotonic():
            return copy.deepcopy(hit[2])
        ver = _WVER
        rows = self._sel_uncached(table, match, select, order, limit)
        if ver == _WVER:
            _RC[key] = (ver, time.monotonic() + _RC_TTL, rows)
        return copy.deepcopy(rows)

    def _sel_uncached(self, table: str, match: dict | None, select: str, order: str | None,
                      limit: int | None) -> list[dict]:
        params: dict = {"select": select, **self._eq(match or {})}
        if order:
            params["order"] = order
        if limit:
            return self._req("GET", table, params={**params, "limit": limit}).json()
        out, offset = [], 0
        while True:  # page past PostgREST's default 1000-row cap
            p = {**params, "limit": 1000, "offset": offset}
            rows = self._req("GET", table, params=p).json()
            out += rows
            if len(rows) < 1000:
                return out
            offset += 1000

    def one(self, table: str, match: dict) -> dict | None:
        rows = self.sel(table, match)
        return rows[0] if rows else None

    def ins(self, table: str, rows: list[dict], upsert: bool = False) -> None:
        _bump()
        for i in range(0, len(rows), 200):
            self._req("POST", table, json=rows[i:i + 200],
                      prefer="resolution=merge-duplicates,return=minimal" if upsert else "return=minimal")

    def upd(self, table: str, match: dict, patch: dict) -> None:
        _bump()
        self._req("PATCH", table, params=self._eq(match), json=patch, prefer="return=minimal")

    def upd_in(self, table: str, ids: list[str], patch: dict) -> int:
        """Update many rows by id with one PATCH per chunk (instead of one request per row)."""
        n = 0
        _bump()
        for i in range(0, len(ids), 40):
            chunk = ids[i:i + 40]
            quoted = ",".join('"' + x.replace('"', "") + '"' for x in chunk)
            self._req("PATCH", table, params={"id": f"in.({quoted})"}, json=patch, prefer="return=minimal")
            n += len(chunk)
        return n

    def delete(self, table: str, match: dict) -> None:
        _bump()
        self._req("DELETE", table, params=self._eq(match), prefer="return=minimal")

    def rpc(self, fn: str, args: dict):
        """Call a Postgres function exposed by PostgREST (e.g. audit_reset)."""
        _bump()
        r = self._req("POST", f"rpc/{fn}", json=args)
        return r.json() if r.content else None
