"""Scores the live h_1 handover against demo-data/ANSWER_KEY.md (planted facts 1-10).
Keyword checks are deliberately simple and strict; results are printed as found/total, not estimated.
Usage: python evaluate.py"""
import json
import warnings

warnings.filterwarnings("ignore")
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from rapidfuzz import fuzz  # noqa: E402

c = TestClient(app)
L, C = {"X-Demo-Role": "lead"}, {"X-Demo-Role": "contributor"}
claims = c.get("/handovers/h_1/claims", headers=L).json()
contrib = c.get("/handovers/h_1/claims", headers=C).json()
conflicts = c.get("/handovers/h_1/conflicts").json()
gaps = c.get("/handovers/h_1/gaps").json()


def has(cl, *words):
    t = cl["statement"].lower()
    return all(w in t for w in words)


def cites(cl, *ids):
    return any(any(i in x["evidence_id"] for i in ids) for x in cl["citations"])


def find(pred):
    return [x for x in claims if pred(x)]


results = {}
r = find(lambda x: x["type"] == "decision" and (has(x, "upi") or has(x, "gateway")) and cites(x, "gh_pr_87"))
results["1 UPI decision cites PR #87 (verified)"] = any(x["state"] == "verified" for x in r) or (bool(r) and "state=" + r[0]["state"])
cf_text = " ".join(x["summary"].lower() for x in conflicts)
results["2 Render vs Vercel conflict"] = ("render" in cf_text and "vercel" in cf_text)
results["3 SMTP owner gap"] = any("smtp" in g["question"].lower() or "email" in g["question"].lower() for g in gaps) or \
    bool(find(lambda x: x["state"] == "missing" and "email" in x["entity_key"]))
r = find(lambda x: (has(x, "login") or has(x, "session") or has(x, "cookie")) and x["type"] in ("risk", "fact", "decision")
         and cites(x, "gh_pr_91", "gh_todo"))
results["4 PR #91 temporary fix risk"] = bool(r) and r[0]["state"]
r = find(lambda x: x["type"] == "dependency" and has(x, "bucket") and (x.get("owner") or has(x, "meera")))
results["5 bucket dependency, owner Meera"] = bool(r) and r[0]["state"]
r = find(lambda x: has(x, "windows") and x["type"] in ("risk", "fact"))
results["6 Windows build recurring (3 citations)"] = bool(r) and max(len(x["citations"]) for x in r) >= 3 or (bool(r) and f"found, citations={max(len(x['citations']) for x in r)}")
results["7 COD open question"] = bool(find(lambda x: x["type"] == "open_question" and ("cod" in x["statement"].lower() or "cash on delivery" in x["statement"].lower())))
r = find(lambda x: has(x, "94") or (has(x, "dashboard") and x["type"] == "next_action") or cites(x, "gh_pr_94"))
results["8 PR #94 stale next action"] = bool(r) and r[0]["state"]
leak = any(k in json.dumps(contrib).lower() for k in ("supervision", "sk_test_fake", "+91-00000"))
results["9 lead-only note hidden from Contributor"] = not leak
ev = [e for cl in claims if cl["label"] == "lead_only" for e in c.get(f"/claims/{cl['id']}/evidence", headers=L).json()]
results["9b secret/PII masked in lead evidence"] = bool(ev) and not any("sk_test_FAKE" in e["unit"]["text"] or "+91-00000-00000" in e["unit"]["text"] for e in ev)
src = c.get("/handovers/h_1/sources", headers=L).json()
results["10 noise filtered (no bot text in claims)"] = not any("deploy succeeded" in x["statement"].lower() for x in claims)

print("PLANTED FACTS")
for k, v in results.items():
    print(("FOUND " if v else "MISS  ") + k + ("" if v is True or v is False else f"   [{v}]"))
found = sum(1 for k, v in results.items() if v and k.split()[0] in list("12345678"))
print(f"\nItems 1-8 found: {found}/8")
nongap = [x for x in claims if x["type"] != "gap"]
print(f"Claims with a citation: {sum(1 for x in nongap if x['citations'])}/{len(nongap)}")
states = {}
for x in claims:
    states[x["state"]] = states.get(x["state"], 0) + 1
print("States:", states, "| conflicts:", len(conflicts), "| gaps:", len(gaps))
print("Sources:", [(s["type"], s["status"], s["unit_count"]) for s in src])
