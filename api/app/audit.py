"""Tamper-evident audit log (Improvement 3): every entry stores the SHA-256 of the previous entry, so editing or
deleting any row breaks the chain from that point. The database also refuses UPDATE/DELETE on audit_log
(migration 0002). Views, exports, approvals and every review decision are recorded here.

Single-instance note: appends are serialised per handover with an in-process lock; with several API instances
the chain could fork (documented limitation)."""
from __future__ import annotations
import hashlib
import json
import threading
from datetime import datetime, timezone

_locks: dict[str, threading.Lock] = {}
_last: dict[str, str] = {}   # handover_id -> hash of the newest entry (cache)
_guard = threading.Lock()


def genesis(hid: str) -> str:
    return hashlib.sha256(f"continuum-genesis:{hid}".encode()).hexdigest()


def _canonical(e: dict) -> str:
    body = {k: e.get(k) for k in ("handover_id", "actor", "role", "action", "target_type", "target_id",
                                  "summary", "meta", "prev_hash")}
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def entry_hash(e: dict) -> str:
    return hashlib.sha256(_canonical(e).encode()).hexdigest()


def _lock(hid: str) -> threading.Lock:
    with _guard:
        return _locks.setdefault(hid, threading.Lock())


def _tail(store, hid: str) -> str:
    if hid in _last:
        return _last[hid]
    rows = store.sel("audit_log", {"handover_id": hid}, select="seq,hash", order="seq.desc", limit=1)
    return rows[0]["hash"] if rows else genesis(hid)


def append(store, hid: str, actor: str, action: str, summary: str = "", role: str = "",
           target_type: str | None = None, target_id: str | None = None, meta: dict | None = None) -> dict:
    """Append one entry. `meta.ts` carries the event time as text so the hash never depends on how the
    database re-formats timestamps."""
    with _lock(hid):
        prev = _tail(store, hid)
        e = {"handover_id": hid, "actor": actor, "role": role, "action": action, "target_type": target_type,
             "target_id": target_id, "summary": summary,
             "meta": {**(meta or {}), "ts": datetime.now(timezone.utc).isoformat()}, "prev_hash": prev}
        e["hash"] = entry_hash(e)
        store.ins("audit_log", [e])
        _last[hid] = e["hash"]
        return e


def verify(store, hid: str) -> dict:
    rows = store.sel("audit_log", {"handover_id": hid}, order="seq.asc")
    prev = genesis(hid)
    for i, r in enumerate(rows):
        if r["prev_hash"] != prev or entry_hash(r) != r["hash"]:
            return {"ok": False, "entries": len(rows), "broken_at": r["seq"], "position": i + 1}
        prev = r["hash"]
    return {"ok": True, "entries": len(rows), "broken_at": None, "head": prev}


def reset(store, hid: str) -> None:
    """Demo reset only: clears this handover's log through the database function that is allowed to."""
    with _lock(hid):
        store.rpc("audit_reset", {"hid": hid})
        _last.pop(hid, None)


def forget_cache() -> None:
    _last.clear()
