"""Round 3 end-to-end check against the DEPLOYED API (creates its own demo copy, so nobody else is affected).
Usage: python live_check.py [api_url]"""
import sys
import time

import httpx

API = (sys.argv[1] if len(sys.argv) > 1 else "https://continuum-api-945j.onrender.com").rstrip("/")
H = {r: {"X-Demo-Role": r} for r in ("lead", "contributor", "leaver", "guest")}
LEAKS = ("misses deadlines", "supervision", "sk_test_fake", "+91-00000", "abcpe1234f", "9999 0000 1231", "campuskart.club@okaxis")
c = httpx.Client(base_url=API, timeout=180)
fails = []


def check(name, ok, extra=""):
    print(("PASS " if ok else "FAIL ") + name, extra)
    if not ok:
        fails.append(name)


t = time.time()
sid = c.post("/demo/sandbox").json()["handover_id"]
check("demo copy created", sid.startswith("h_demo_"), f"{sid} in {time.time() - t:.1f}s")
for role in ("contributor", "guest"):
    v = c.get(f"/handovers/{sid}/view", headers=H[role]).json()
    n = sum(len(s["claims"]) for s in v["sections"])
    check(f"{role} sees published v1 on first click", v["version"] == 1 and n > 0, f"claims={n} hidden={v['hidden_count']}")
cf = c.get(f"/handovers/{sid}/conflicts", headers=H["lead"]).json()
check("conflicts have sides with dated evidence", cf and all(s["evidence"] for x in cf for s in x["sides"]),
      f"{len(cf)} conflicts: " + "; ".join(f"{x['kind']}/{x['resolution']}/{len(x['claim_ids'])} sides" for x in cf))
q = c.get(f"/handovers/{sid}/redactions", headers=H["lead"]).json()
dets = sorted({i["detector"] for i in q["items"]})
check("privacy queue lists India detectors + people judgement", {"upi_id", "pan", "aadhaar", "people_sensitive"} <= set(dets), str(dets))
check("privacy queue never sends raw values", not any(k in str(q).lower() for k in ("abcpe1234f", "okaxis", "9999 0000 1231")))

# acknowledgement loop
r = c.post(f"/handovers/{sid}/ack", headers=H["contributor"], json={"section": "decision_log", "status": "unclear",
                                                                    "note": "Why did we drop the card gateway?"}).json()
tid = (r.get("task") or {}).get("id")
check("flag unclear creates a task", bool(tid))
check("leaver sees the task", any(x["id"] == tid for x in c.get(f"/handovers/{sid}/tasks", headers=H["leaver"]).json()))
a = c.post(f"/tasks/{tid}/answer", headers=H["leaver"], json={"answer": "The gateway needed merchant KYC we could not get."})
check("leaver answers", a.status_code == 200 and a.json()["status"] == "answered")
bad = c.post(f"/tasks/{tid}/answer", headers=H["leaver"], json={"answer": "key is sk_test_FAKE_51abcDEF0123456789"})
check("secret in an answer is refused", bad.status_code == 400)
claims = c.get(f"/handovers/{sid}/claims", headers=H["lead"]).json()
dec = next((x for x in claims if x["type"] == "decision" and "upi" in x["statement"].lower()), None) or \
    next(x for x in claims if x["type"] == "decision")
rr = c.post(f"/tasks/{tid}/resolve", headers=H["lead"], json={"action": "attach", "claim_id": dec["id"],
                                                               "statement": dec["statement"] + " (Leaver: the gateway needed merchant KYC.)"})
check("reviewer attaches the answer to a claim", rr.status_code == 200, rr.text[:120] if rr.status_code != 200 else "")

# conflicts: settle every open/deferred one
for x in cf:
    if x["resolution"] in ("open", "deferred"):
        keep = x["sides"][-1]["claim"]["id"]
        rs = c.post(f"/conflicts/{x['id']}/resolve", headers=H["lead"],
                    json={"action": "keep", "keep_claim_ids": [keep], "note": "Checked with the team on a call today."})
        if rs.status_code == 409:
            continue  # settled together with an overlapping conflict
        check(f"conflict {x['id'].split('__')[-1]} settled", rs.status_code == 200, rs.text[:120] if rs.status_code != 200 else "")
# privacy decisions that block publishing
for i in c.get(f"/handovers/{sid}/redactions?status=pending", headers=H["lead"]).json()["items"]:
    d = "escalate_lead_only" if i["detector"] == "people_sensitive" else "keep_masked"
    c.post(f"/redactions/{i['id']}/decide", headers=H["lead"], json={"decision": d, "reason": "Personal remark, lead only"})
c.post(f"/handovers/{sid}/claims/bulk", headers=H["lead"], json={"action": "approve"})
p = c.post(f"/handovers/{sid}/publish", headers=H["lead"])
check("publish v2", p.status_code == 200 and p.json().get("version") == 2, p.text[:200])
d = c.get(f"/handovers/{sid}/versions/1/diff/2", headers=H["contributor"]).json()
check("successor sees what changed v1 -> v2", bool(d.get("changed") or d.get("added") or d.get("removed")),
      f"changed={len(d.get('changed', []))} added={len(d.get('added', []))} removed={len(d.get('removed', []))} sections={d.get('sections_changed')}")
v = c.get(f"/handovers/{sid}/view", headers=H["contributor"]).json()
check("view marks changed sections", any(s["changed"] for s in v["sections"]), str([s["key"] for s in v["sections"] if s["changed"]]))

# leaks: every endpoint, every non-lead role
for role in ("contributor", "leaver", "guest"):
    for path in ("view", "claims", "conflicts", "gaps?with_evidence=1", "versions", "versions/1/diff/2", "tasks", "notifications", "sources"):
        txt = c.get(f"/handovers/{sid}/{path}", headers=H[role]).text.lower()
        hit = [k for k in LEAKS if k in txt]
        if hit:
            check(f"no leak: {role} {path}", False, str(hit))
check("leak sweep done (failures listed above if any)", True)
au = c.get(f"/handovers/{sid}/audit/verify", headers=H["lead"]).json()
check("audit chain verifies", au.get("ok") is True, str(au))
acts = {x["action"] for x in c.get(f"/handovers/{sid}/audit", headers=H["lead"]).json()}
check("audit has views, decisions, publish", {"view_handover", "resolve_conflict", "publish"} <= acts, str(sorted(acts)))
check("guest cannot export", c.post(f"/handovers/{sid}/exports", headers=H["guest"], json={"format": "md"}).status_code == 403)
print("\n" + ("ALL PASSED" if not fails else f"{len(fails)} FAILED: {fails}"), f"({time.time() - t:.0f}s)")
sys.exit(1 if fails else 0)
