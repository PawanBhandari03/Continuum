"""Proves that row-level security in Postgres (migration 0003) enforces membership and roles, independent of the API.
Creates two throwaway users with the Supabase admin API, signs them in, then reads tables DIRECTLY through PostgREST
with each user's own token. Deletes everything it created. Usage: python rls_check.py  (needs api/.env or env vars)"""
import os
import sys
import uuid

import httpx

from app import config  # noqa: F401  (loads .env)

U = os.environ["SUPABASE_URL"].rstrip("/")
SECRET, PUB = os.environ["SUPABASE_SECRET_KEY"], os.environ["SUPABASE_PUBLISHABLE_KEY"]
API = os.environ.get("API", "https://continuum-api-945j.onrender.com").rstrip("/")
admin = {"apikey": SECRET, "Authorization": f"Bearer {SECRET}", "Content-Type": "application/json"}
tag = uuid.uuid4().hex[:6]
fails = []


def check(name, ok, extra=""):
    print(("PASS " if ok else "FAIL ") + name, extra)
    if not ok:
        fails.append(name)


def make_user(email, pw):
    r = httpx.post(f"{U}/auth/v1/admin/users", headers=admin, json={"email": email, "password": pw, "email_confirm": True}, timeout=30)
    r.raise_for_status()
    return r.json()["id"]


def login(email, pw):
    r = httpx.post(f"{U}/auth/v1/token?grant_type=password", headers={"apikey": PUB, "Content-Type": "application/json"},
                   json={"email": email, "password": pw}, timeout=30)
    r.raise_for_status()
    return r.json()["access_token"]


def rest(token, table, query=""):
    return httpx.get(f"{U}/rest/v1/{table}?{query}", headers={"apikey": PUB, "Authorization": f"Bearer {token}"}, timeout=30).json()


pw = "Rls-test-" + uuid.uuid4().hex
a_mail, b_mail, c_mail = (f"rls-{n}-{tag}@example.com" for n in ("lead", "succ", "stranger"))
ids = []
hid = None
try:
    for m in (a_mail, b_mail, c_mail):
        ids.append(make_user(m, pw))
    ta, tb, tc = (login(m, pw) for m in (a_mail, b_mail, c_mail))
    A = lambda t: {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}  # noqa: E731

    # create a PRIVATE handover through the API as user A (becomes its lead), seed it from the demo template
    h = httpx.post(f"{API}/handovers", headers=A(ta), json={"leaver": "a", "successor": "b", "target_date": "2026-12-01"}, timeout=60).json()
    hid = h["id"]
    check("signed-in creation makes a private handover with the creator as lead",
          [m["role"] for m in httpx.get(f"{API}/handovers/{hid}/members", headers=A(ta), timeout=60).json()] == ["lead"])
    # plant evidence at each label directly with the service key (what the pipeline would produce)
    sid = f"{hid}__src"
    httpx.post(f"{U}/rest/v1/sources", headers={**admin, "Prefer": "return=minimal"}, json=[
        {"id": sid + "_c", "handover_id": hid, "type": "notes", "name": "contrib notes", "status": "ok", "default_label": "contributor"},
        {"id": sid + "_l", "handover_id": hid, "type": "notes", "name": "lead notes", "status": "ok", "default_label": "lead_only"}], timeout=30).raise_for_status()
    httpx.post(f"{U}/rest/v1/evidence_units", headers={**admin, "Prefer": "return=minimal"}, json=[
        {"id": f"{hid}__e1", "handover_id": hid, "source_id": sid + "_c", "author": "x", "ts": "2026-10-01T00:00:00+00:00", "text": "CONTRIB-VISIBLE", "locator": "n://1", "label": "contributor"},
        {"id": f"{hid}__e2", "handover_id": hid, "source_id": sid + "_l", "author": "x", "ts": "2026-10-01T00:00:00+00:00", "text": "LEAD-ONLY-SECRET", "locator": "n://2", "label": "lead_only"}], timeout=30).raise_for_status()
    httpx.post(f"{API}/handovers/{hid}/members", headers=A(ta), json={"email": b_mail, "role": "contributor"}, timeout=60).raise_for_status()

    q = f"handover_id=eq.{hid}&select=id,text"
    lead_rows = rest(ta, "evidence_units", q)
    succ_rows = rest(tb, "evidence_units", q)
    stranger_rows = rest(tc, "evidence_units", q)
    # the invited member's first call links their account (done by the API middleware)
    httpx.get(f"{API}/handovers/{hid}/me", headers=A(tb), timeout=60)
    succ_rows = rest(tb, "evidence_units", q)
    check("DB: lead reads both evidence units", len(lead_rows) == 2, str([r["id"][-2:] for r in lead_rows]))
    check("DB: contributor reads ONLY the contributor-level unit", [r["text"] for r in succ_rows] == ["CONTRIB-VISIBLE"], str([r["text"] for r in succ_rows]))
    check("DB: stranger reads nothing", stranger_rows == [], str(stranger_rows)[:80])
    check("DB: nobody signed in reads nothing", httpx.get(f"{U}/rest/v1/evidence_units?{q}", headers={"apikey": PUB}, timeout=30).json() == [])
    check("DB: stranger cannot see the handover row", rest(tc, "handovers", f"id=eq.{hid}") == [])
    check("DB: contributor cannot read the audit log", rest(tb, "audit_log", f"handover_id=eq.{hid}") == [])
    check("DB: lead can read the audit log", len(rest(ta, "audit_log", f"handover_id=eq.{hid}")) >= 1)
    check("DB: contributor cannot read lead-only source", [r["name"] for r in rest(tb, "sources", f"handover_id=eq.{hid}&select=name")] == ["contrib notes"])
    w = httpx.patch(f"{U}/rest/v1/evidence_units?id=eq.{hid}__e1", headers={**A(tb), "apikey": PUB}, json={"text": "tampered"}, timeout=30)
    check("DB: a member cannot write directly", w.status_code in (401, 403) or rest(ta, "evidence_units", f"id=eq.{hid}__e1")[0]["text"] == "CONTRIB-VISIBLE", f"status {w.status_code}")
    # API layer, same people
    check("API: stranger gets 404 for the private handover", httpx.get(f"{API}/handovers/{hid}", headers=A(tc), timeout=60).status_code == 404)
    check("API: anonymous gets 401", httpx.get(f"{API}/handovers/{hid}", timeout=60).status_code == 401)
    check("API: forged lead header does not lift a contributor",
          httpx.get(f"{API}/handovers/{hid}/audit", headers={**A(tb), "X-Demo-Role": "lead"}, timeout=60).status_code == 403)
finally:
    if hid:
        httpx.delete(f"{U}/rest/v1/handovers?id=eq.{hid}", headers=admin, timeout=30)
    for i in ids:
        httpx.delete(f"{U}/auth/v1/admin/users/{i}", headers=admin, timeout=30)
print("\n" + ("ALL PASSED" if not fails else f"{len(fails)} FAILED: {fails}"))
sys.exit(1 if fails else 0)
