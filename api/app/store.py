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


class Store:
    def __init__(self) -> None:
        self.url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        key = os.environ.get("SUPABASE_SECRET_KEY", "")
        if not self.url or not key:
            raise StoreError("SUPABASE_URL / SUPABASE_SECRET_KEY not configured")
        self.http = httpx.Client(timeout=30, headers={"apikey": key, "Content-Type": "application/json"})

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
        return {k: (v if isinstance(v, str) and v.startswith(("in.", "eq.", "neq.", "is.")) else f"eq.{v}")
                for k, v in match.items()}

    def sel(self, table: str, match: dict | None = None, select: str = "*", order: str | None = None) -> list[dict]:
        params: dict = {"select": select, **self._eq(match or {})}
        if order:
            params["order"] = order
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
        for i in range(0, len(rows), 200):
            self._req("POST", table, json=rows[i:i + 200],
                      prefer="resolution=merge-duplicates,return=minimal" if upsert else "return=minimal")

    def upd(self, table: str, match: dict, patch: dict) -> None:
        self._req("PATCH", table, params=self._eq(match), json=patch, prefer="return=minimal")

    def delete(self, table: str, match: dict) -> None:
        self._req("DELETE", table, params=self._eq(match), prefer="return=minimal")
