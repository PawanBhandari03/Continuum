"""In-memory stand-in for Store (same methods, same PostgREST-style matching) used by API tests.
Implements just enough of PostgREST: eq/neq/in./is.null matching, order, select, upsert by primary key,
and the column defaults the API relies on."""
from __future__ import annotations
import copy
import itertools
import uuid
from datetime import datetime, timezone

PK = {
    "acknowledgements": ("handover_id", "section", "actor", "version"),
    "handover_versions": ("handover_id", "version"),
}
_DEFAULTS = {
    "handovers": lambda: {"status": "draft", "version": 0, "revision": 1, "approved_by": None, "published_at": None,
                          "leaver_available": True, "template_id": None, "created_at": _now()},
    "review_actions": lambda: {"id": str(uuid.uuid4()), "at": _now(), "claim_id": None, "before": None, "after": None},
    "jobs": lambda: {"stage": None, "progress": 0, "error": None, "created_at": _now()},
    "acknowledgements": lambda: {"note": None, "at": _now(), "version": 0, "carried_over": False},
    "conflicts": lambda: {"resolution": "open", "resolved_by": None, "note": None, "entity_key": "", "kind": "value",
                          "severity": "blocking", "detected_by": "model", "resolution_claim_id": None,
                          "decided_at": None, "label": "contributor"},
    "conflict_events": lambda: {"id": str(uuid.uuid4()), "at": _now(), "payload": {}, "note": None},
    "gaps": lambda: {"status": "open", "answer": None, "answer_evidence_id": None, "evidence_found": []},
    "evidence_units": lambda: {"redactions": [], "flags": []},
    "claims": lambda: {"method": "model"},
    "tasks": lambda: {"status": "open", "assigned_to": "both", "answer": None, "answer_by": None,
                      "answer_evidence_id": None, "resolution_note": None, "version_resolved": None,
                      "claim_id": None, "section": None, "created_at": _now(), "updated_at": _now()},
    "redaction_reviews": lambda: {"decision": "pending", "decided_by": None, "decided_at": None, "reason": None},
    "handover_versions": lambda: {"published_at": _now(), "summary": {}},
    "sources": lambda: {"status_reason": None, "unit_count": 0},
}
_seq = itertools.count(1)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _matches(row: dict, match: dict) -> bool:
    for k, v in match.items():
        cur = row.get(k)
        if isinstance(v, str) and v.startswith("in.("):
            vals = [x.strip().strip('"') for x in v[4:-1].split(",") if x.strip()]
            if str(cur) not in vals:
                return False
        elif isinstance(v, str) and v.startswith("neq."):
            if str(cur) == v[4:]:
                return False
        elif isinstance(v, str) and v.startswith(("lt.", "gt.")):
            if cur is None or not ((str(cur) < v[3:]) if v[:2] == "lt" else (str(cur) > v[3:])):
                return False
        elif isinstance(v, str) and v == "is.null":
            if cur is not None:
                return False
        elif isinstance(v, str) and v.startswith("eq."):
            if str(cur) != v[3:]:
                return False
        elif isinstance(v, bool):
            if cur is not v:
                return False
        elif str(cur) != str(v):
            return False
    return True


class MemStore:
    def __init__(self) -> None:
        self.t: dict[str, list[dict]] = {}
        self.rpc_calls: list[tuple] = []

    def _rows(self, table: str) -> list[dict]:
        return self.t.setdefault(table, [])

    def sel(self, table, match=None, select="*", order=None, limit=None):
        rows = [r for r in self._rows(table) if _matches(r, match or {})]
        if order:
            col, _, d = order.partition(".")
            rows = sorted(rows, key=lambda r: (r.get(col) is None, r.get(col)), reverse=(d == "desc"))
        if limit:
            rows = rows[:limit]
        rows = copy.deepcopy(rows)
        if select != "*":
            cols = [c.strip() for c in select.split(",")]
            rows = [{c: r.get(c) for c in cols} for r in rows]
        return rows

    def one(self, table, match):
        rows = self.sel(table, match)
        return rows[0] if rows else None

    def ins(self, table, rows, upsert=False):
        if len({frozenset(r) for r in rows}) > 1:  # PostgREST rejects a batch whose rows have different keys
            raise RuntimeError(f"insert into {table}: all rows in one batch must have the same keys")
        pk = PK.get(table, ("id",))
        for r in rows:
            r = {**_DEFAULTS.get(table, dict)(), **copy.deepcopy(r)}
            if table == "audit_log" and "seq" not in r:
                r["seq"] = next(_seq)
            key = tuple(r.get(k) for k in pk)
            existing = next((x for x in self._rows(table) if all(k in x for k in pk)
                             and tuple(x.get(k) for k in pk) == key and None not in key), None)
            if existing is not None:
                if not upsert:
                    raise RuntimeError(f"duplicate key in {table}: {key}")
                existing.update(r)
            else:
                self._rows(table).append(r)

    def tamper(self, table, match, patch):
        """Test helper only: change rows the way someone with raw database access might."""
        for r in self._rows(table):
            if _matches(r, match):
                r.update(copy.deepcopy(patch))

    def upd(self, table, match, patch):
        if table == "audit_log":
            raise RuntimeError("audit_log is append-only")
        for r in self._rows(table):
            if _matches(r, match):
                r.update(copy.deepcopy(patch))

    def upd_in(self, table, ids, patch):
        s = set(ids)
        for r in self._rows(table):
            if r.get("id") in s:
                r.update(copy.deepcopy(patch))
        return len(ids)

    def delete(self, table, match):
        if table == "audit_log":
            raise RuntimeError("audit_log is append-only")
        self.t[table] = [r for r in self._rows(table) if not _matches(r, match)]

    def rpc(self, fn: str, args: dict):
        self.rpc_calls.append((fn, args))
        if fn == "audit_reset":
            self.t["audit_log"] = [r for r in self._rows("audit_log") if r["handover_id"] != args["hid"]]
        return None
