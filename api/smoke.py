"""End-to-end smoke test of the API against the live Supabase project (uses the model cache where
possible). Usage: python smoke.py [--no-reconstruct]"""
import sys
import time
import warnings

warnings.filterwarnings("ignore")
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

c = TestClient(app)
L, C = {"X-Demo-Role": "lead"}, {"X-Demo-Role": "contributor"}
fails = []


def check(name, ok, extra=""):
    print(("PASS " if ok else "FAIL ") + name, extra)
    if not ok:
        fails.append(name)


check("seed", c.post("/demo/seed").status_code == 200)
src_l = c.get("/handovers/h_1/sources", headers=L).json()
src_c = c.get("/handovers/h_1/sources", headers=C).json()
check("lead-only source hidden from contributor", len(src_c) == len(src_l) - 1, f"{len(src_l)} vs {len(src_c)}")

if "--no-reconstruct" not in sys.argv:
    jid = c.post("/handovers/h_1/reconstruct", headers=L).json()["job_id"]
    for _ in range(100):
        j = c.get(f"/jobs/{jid}").json()
        if j["status"] in ("done", "failed"):
            break
        time.sleep(5)
    print("job:", j)
    check("contributor cannot start reconstruct", c.post("/handovers/h_1/reconstruct", headers=C).status_code == 403)

cl = c.get("/handovers/h_1/claims", headers=L).json()
cc = c.get("/handovers/h_1/claims", headers=C).json()
print("claims: lead", len(cl), "contributor", len(cc))
txt = " ".join(x["statement"] for x in cc)
check("no lead-only text in contributor claims", "supervision" not in txt and "sk_test" not in txt)
check("every non-gap claim has a citation", all(x["citations"] for x in cl if x["type"] != "gap"))
lead_only = [x for x in cl if x["label"] == "lead_only"]
check("lead-only claim exists for lead", len(lead_only) > 0, f"{len(lead_only)}")
check("lead-only claim absent for contributor", not any(x["label"] == "lead_only" for x in cc))
if lead_only:
    check("contributor evidence request denied", c.get(f"/claims/{lead_only[0]['id']}/evidence", headers=C).status_code == 403)
    ev = c.get(f"/claims/{lead_only[0]['id']}/evidence", headers=L).json()
    shown = ev[0]["unit"]["text"] if ev else ""
    check("secret/PII masked even for lead", "sk_test_FAKE" not in shown and "+91-00000-00000" not in shown, shown[:120])
v = c.get("/handovers/h_1/view", headers=C).json()
check("view reports hidden_count (count only)", v["hidden_count"] >= 0, str(v["hidden_count"]))
print("readiness", c.get("/handovers/h_1/readiness").json())
print("conflicts", len(c.get("/handovers/h_1/conflicts").json()), "gaps", len(c.get("/handovers/h_1/gaps").json()))
check("contributor cannot publish", c.post("/handovers/h_1/publish", headers=C).status_code == 403)
r = c.post("/handovers/h_1/publish", headers=L)
check("publish blocked while unreviewed", r.status_code == 400, str(r.json())[:150])
print("\nFAILED:" if fails else "\nALL PASSED", fails if fails else "")
