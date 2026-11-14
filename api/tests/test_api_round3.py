"""Round 3 API behaviour against an in-memory store: demo copies, published versions, the acknowledgement loop,
version diff, conflict decisions with history, the audit chain and permission rules."""
import pytest
from fastapi.testclient import TestClient

from app import main
from app.memstore import MemStore

L, C, LV, G = ({"X-Demo-Role": r} for r in ("lead", "contributor", "leaver", "guest"))
LEAD_SECRET = "frequently misses deadlines"


def _seed(store: MemStore) -> None:
    store.ins("handovers", [{"id": "h_1", "leaver": "aditi", "successor": "karan", "successor_role": "contributor",
                             "target_date": "2026-11-30", "version": 0, "status": "in_review"},
                            {"id": "h_1_seed", "leaver": "aditi", "successor": "karan",
                             "successor_role": "contributor", "target_date": "2026-11-30"}])
    store.ins("sources", [
        {"id": "src_github", "handover_id": "h_1", "type": "github", "name": "repo", "status": "ok",
         "default_label": "contributor", "unit_count": 3},
        {"id": "src_mentor-notes", "handover_id": "h_1", "type": "notes", "name": "mentor", "status": "ok",
         "default_label": "lead_only", "unit_count": 1}])
    U = lambda i, s, text, label="contributor", ts="2026-10-02T10:00:00+00:00": {  # noqa: E731
        "id": i, "handover_id": "h_1", "source_id": s, "author": "dev", "ts": ts, "text": text,
        "locator": f"x://{i}", "label": label, "redactions": [], "flags": []}
    store.ins("evidence_units", [
        U("gh_readme", "src_github", "README.md: The app is deployed on Render.", ts="2026-09-12T10:00:00+00:00"),
        U("gh_commit_a", "src_github", "Commit a1: add vercel.json and deploy the web app to Vercel"),
        U("gh_pr_87", "src_github", "PR #87 (merged): switch payments to UPI deep links because merchant KYC failed"),
        U("ev_mentor_1", "src_mentor-notes", f"Dev {LEAD_SECRET} and needs supervision.", label="lead_only")])
    cl = lambda i, st, cites, label="contributor", state="verified", typ="fact", section="state", ek="deploy", cf=None: {  # noqa: E731
        "id": f"seed__{i}", "handover_id": "h_1_seed", "type": typ, "statement": st, "state": state,
        "confidence_reason": "", "workstream": ek, "entity_key": ek, "owner": None, "label": label,
        "review_status": "pending", "sensitive": False, "section": section, "date": "2026-10-02",
        "citations": [{"evidence_id": e, "quote": q, "support": "full"} for e, q in cites],
        "conflict_id": cf, "version": 1, "confirmed_by": None, "confirmed_at": None, "method": "model"}
    store.ins("claims", [
        cl("cl_1", "The app is deployed on Render.", [("gh_readme", "deployed on Render")], state="conflicting",
           section="unresolved", cf="seed__cf_1"),
        cl("cl_2", "The web app deploys to Vercel.", [("gh_commit_a", "deploy the web app to Vercel")],
           state="conflicting", section="unresolved", cf="seed__cf_1"),
        cl("cl_3", "Payments moved to UPI deep links because merchant KYC failed.",
           [("gh_pr_87", "switch payments to UPI deep links")], typ="decision", section="decision_log", ek="payments"),
        cl("cl_L1", f"Dev {LEAD_SECRET}.", [("ev_mentor_1", LEAD_SECRET)], label="lead_only", ek="people",
           section="risks", typ="risk"),
        cl("cl_gap_email", "No verified information about: email.", [], state="missing", typ="gap",
           section="unresolved", ek="email")])
    store.ins("conflicts", [{"id": "seed__cf_1", "handover_id": "h_1_seed", "claim_ids": ["seed__cl_1", "seed__cl_2"],
                             "summary": "Sources disagree about deploy", "entity_key": "deploy", "kind": "staleness"}])
    store.ins("gaps", [{"id": "seed__gp_email", "handover_id": "h_1_seed", "claim_id": "seed__cl_gap_email",
                        "question": "Who owns the SMTP account?", "evidence_found": []}])


@pytest.fixture()
def api():
    s = MemStore()
    _seed(s)
    main.use_store(s)
    main._readme_date["v"] = None  # no network lookups in tests
    c = TestClient(main.app)
    sid = c.post("/demo/sandbox").json()["handover_id"]
    return c, s, sid


def text_of(resp) -> str:
    return resp.text.lower()


def test_sandbox_starts_published_with_content_for_every_role(api):
    c, s, sid = api
    assert sid.startswith("h_demo_")
    for h in (C, G):
        v = c.get(f"/handovers/{sid}/view", headers=h).json()
        assert v["version"] == 1 and not v["not_published"]
        assert sum(len(x["claims"]) for x in v["sections"]) > 0
    # the template is untouched and other visitors get their own copy
    other = c.post("/demo/sandbox").json()["handover_id"]
    assert other != sid
    c.post(f"/conflicts/{sid}__cf_1/resolve", headers=L, json={"action": "keep", "keep_claim_ids": [f"{sid}__cl_2"],
                                                              "note": "Commits since 2 Oct configure Vercel."})
    assert s.one("conflicts", {"id": f"{other}__cf_1"})["resolution"] == "deferred"


def test_successor_reads_published_snapshot_not_live_draft(api):
    c, s, sid = api
    cid = f"{sid}__cl_3"
    c.patch(f"/claims/{cid}", headers=L, json={"action": "edit", "edited_statement": "EDITED IN DRAFT"})
    assert "edited in draft" not in text_of(c.get(f"/handovers/{sid}/view", headers=C))
    assert "edited in draft" in text_of(c.get(f"/handovers/{sid}/view?draft=1", headers=L))
    assert c.get(f"/handovers/{sid}", headers=L).json()["status"] == "in_review"


def test_lead_only_text_never_reaches_contributor_or_guest_anywhere(api):
    c, s, sid = api
    for h in (C, G, LV):
        for path in ("view", "claims", "conflicts", "gaps", "versions", "notifications", "tasks"):
            r = c.get(f"/handovers/{sid}/{path}", headers=h)
            assert LEAD_SECRET not in text_of(r), (h, path)
        assert c.get(f"/claims/{sid}__cl_L1/evidence", headers=h).status_code == 404
    assert LEAD_SECRET in text_of(c.get(f"/handovers/{sid}/view", headers=L))


def test_guest_sees_public_only_and_cannot_act(api):
    c, s, sid = api
    v = c.get(f"/handovers/{sid}/view", headers=G).json()
    seen = {x["id"] for sec in v["sections"] for x in sec["claims"]}
    assert seen and all(cid.split("__")[-1] in ("cl_1", "cl_2", "cl_3") for cid in seen)  # repo evidence only
    assert v["hidden_count"] > 0
    assert c.get(f"/handovers/{sid}/tasks", headers=G).status_code == 403
    assert c.post(f"/handovers/{sid}/ack", headers=G, json={"section": "state", "status": "acknowledged"}).status_code == 403
    assert c.post(f"/handovers/{sid}/exports", headers=G, json={"format": "md"}).status_code == 403


def test_ack_rules(api):
    c, s, sid = api
    assert c.post(f"/handovers/{sid}/ack", headers=L, json={"section": "state", "status": "acknowledged"}).status_code == 403
    h = c.post("/handovers", json={"leaver": "a", "successor": "b", "target_date": "2026-12-01"}).json()
    r = c.post(f"/handovers/{h['id']}/ack", headers=C, json={"section": "state", "status": "acknowledged"})
    assert r.status_code == 400  # nothing published yet


def test_full_acknowledgement_loop_and_diff(api):
    c, s, sid = api
    # successor flags a section
    r = c.post(f"/handovers/{sid}/ack", headers=C, json={"section": "decision_log", "status": "unclear",
                                                          "note": "Why did we drop the card gateway?"}).json()
    tid = r["task"]["id"]
    c.post(f"/handovers/{sid}/ack", headers=C, json={"section": "state", "status": "acknowledged"})
    # leaver sees and answers it
    assert any(t["id"] == tid for t in c.get(f"/handovers/{sid}/tasks", headers=LV).json())
    a = c.post(f"/tasks/{tid}/answer", headers=LV, json={"answer": "The gateway needed merchant KYC we could not get."})
    assert a.json()["status"] == "answered"
    # reviewer attaches the answer to the decision claim, settles the conflict, publishes v2
    c.post(f"/tasks/{tid}/resolve", headers=L, json={"action": "attach", "claim_id": f"{sid}__cl_3",
                                                     "statement": "Payments moved to UPI deep links: the card gateway needed merchant KYC we could not get."})
    c.post(f"/conflicts/{sid}__cf_1/resolve", headers=L,
           json={"action": "keep", "keep_claim_ids": [f"{sid}__cl_2"], "note": "Commits since 2 Oct configure Vercel."})
    p = c.post(f"/handovers/{sid}/publish", headers=L).json()
    assert p["version"] == 2 and len(p["sha256"]) == 64
    # successor sees what changed; unchanged acks carry over, changed sections must be read again
    d = c.get(f"/handovers/{sid}/versions/1/diff/2", headers=C).json()
    changed = {x["claim_id"]: x for x in d["changed"]}
    assert f"{sid}__cl_3" in changed and "merchant kyc" in changed[f"{sid}__cl_3"]["after"].lower()
    assert f"{sid}__cl_1" in {x["id"] for x in d["removed"]}  # superseded Render side
    v = c.get(f"/handovers/{sid}/view", headers=C).json()
    home = next(x for x in v["sections"] if any(y["id"] == f"{sid}__cl_3" for y in x["claims"]))
    assert home["changed"] and home["ack"] == "none"  # changed section must be read again
    assert v["last_ack_version"] == 1
    unchanged = [x for x in v["sections"] if not x["changed"]]
    assert unchanged and not any(x["key"] == home["key"] for x in unchanged)


def test_conflict_decisions_need_reasons_and_keep_history(api):
    c, s, sid = api
    cf = f"{sid}__cf_1"
    assert c.post(f"/conflicts/{cf}/resolve", headers=L, json={"action": "keep", "keep_claim_ids": [f"{sid}__cl_2"],
                                                               "note": "short"}).status_code == 400
    r = c.post(f"/conflicts/{cf}/resolve", headers=L, json={"action": "both_true", "note": "Checked with Dev on a call.",
                                                            "scope_note": "Render hosts the API; Vercel hosts the web app."})
    assert r.json()["resolution"] == "both_true" and r.json()["resolution_claim_id"]
    assert c.post(f"/conflicts/{cf}/resolve", headers=L, json={"action": "defer"}).status_code == 409
    c.post(f"/conflicts/{cf}/resolve", headers=L, json={"action": "reopen"})
    assert s.one("claims", {"id": f"{sid}__cl_1"})["review_status"] == "approved"  # restored from v1 state
    assert not s.one("claims", {"id": r.json()["resolution_claim_id"]})
    hist = [e["action"] for e in c.get(f"/conflicts/{cf}/history", headers=L).json()]
    assert hist[-2:] == ["both_true", "reopened"]
    # Round 2 clients still work
    r2 = c.post(f"/conflicts/{cf}/resolve", headers=L, json={"resolution": "unresolved_followup", "note": ""})
    assert r2.json()["resolution"] == "deferred"


def test_conflict_sides_carry_evidence_with_dates(api):
    c, s, sid = api
    cf = c.get(f"/handovers/{sid}/conflicts", headers=L).json()[0]
    dates = sorted(e["ts"][:10] for side in cf["sides"] for e in side["evidence"])
    assert dates == ["2026-09-12", "2026-10-02"] and cf["kind"] == "staleness"


def test_audit_chain_records_views_exports_and_detects_tampering(api):
    c, s, sid = api
    c.get(f"/handovers/{sid}/view", headers=C)
    c.post(f"/handovers/{sid}/exports", headers=C, json={"format": "markdown"})
    rows = c.get(f"/handovers/{sid}/audit", headers=L).json()
    actions = {r["action"] for r in rows}
    assert {"publish", "view_handover", "export"} <= actions
    assert c.get(f"/handovers/{sid}/audit/verify", headers=L).json()["ok"]
    victim = sorted(s.sel("audit_log", {"handover_id": sid}), key=lambda r: r["seq"])[1]
    s.tamper("audit_log", {"seq": victim["seq"]}, {"summary": "nothing happened here"})
    v = c.get(f"/handovers/{sid}/audit/verify", headers=L).json()
    assert not v["ok"] and v["broken_at"] == victim["seq"]
    assert c.get(f"/handovers/{sid}/audit", headers=C).status_code == 403


def test_secrets_refused_in_answers(api):
    c, s, sid = api
    tid = c.post(f"/handovers/{sid}/tasks", headers=C, json={"kind": "successor_question", "section": "dependencies",
                                                              "text": "What is the Stripe key?"}).json()["id"]
    r = c.post(f"/tasks/{tid}/answer", headers=LV, json={"answer": "it is sk_test_FAKE_51abcDEF0123456789"})
    assert r.status_code == 400 and "secret" in r.text.lower()


def test_publish_blocked_until_open_conflicts_settled_and_nothing_changed(api):
    c, s, sid = api
    assert c.post(f"/handovers/{sid}/publish", headers=L).status_code == 400  # nothing changed since v1
    c.post(f"/conflicts/{sid}__cf_1/resolve", headers=L, json={"action": "reopen"})
    r = c.post(f"/handovers/{sid}/publish", headers=L)
    assert r.status_code == 400 and "conflict" in r.text.lower()


def test_reset_restores_starting_state(api):
    c, s, sid = api
    c.post(f"/conflicts/{sid}__cf_1/resolve", headers=L, json={"action": "keep", "keep_claim_ids": [f"{sid}__cl_2"],
                                                              "note": "Commits since 2 Oct configure Vercel."})
    c.post(f"/handovers/{sid}/publish", headers=L)
    c.post(f"/handovers/{sid}/reset", headers=L)
    h = c.get(f"/handovers/{sid}").json()
    assert h["version"] == 1 and h["status"] == "published"
    assert c.get(f"/handovers/{sid}/audit/verify", headers=L).json()["ok"]
    assert c.post("/handovers/nope/reset", headers=L).status_code == 404


def test_hidden_sandboxes_not_listed(api):
    c, s, sid = api
    ids = {h["id"] for h in c.get("/handovers").json()}
    assert sid not in ids and "h_1" in ids
    assert sid in {h["id"] for h in c.get(f"/handovers?include={sid}").json()}


def test_unchanged_sections_keep_their_acknowledgement(api):
    c, s, sid = api
    c.post(f"/handovers/{sid}/ack", headers=C, json={"section": "first_week", "status": "acknowledged"})
    c.post(f"/conflicts/{sid}__cf_1/resolve", headers=L, json={"action": "keep", "keep_claim_ids": [f"{sid}__cl_2"],
                                                              "note": "Commits since 2 Oct configure Vercel."})
    assert c.post(f"/handovers/{sid}/publish", headers=L).json()["version"] == 2
    sec = {x["key"]: x for x in c.get(f"/handovers/{sid}/view", headers=C).json()["sections"]}
    assert sec["first_week"]["ack"] == "acknowledged" and sec["first_week"]["carried_over"]


def _privacy_seed(s, sid):
    from app.protect import scan
    text = ("Pay the vendor at campuskart.club@okaxis, PAN ABCPE1234F. "
            "Rohan has been unreliable about replying to sellers this month.")
    s.ins("evidence_units", [{"id": f"{sid}__ev_vendor", "handover_id": sid, "source_id": f"{sid}__src_github",
                              "author": "notes", "ts": "2026-10-12T12:00:00+00:00", "text": text, "locator": "notes://v#p1",
                              "label": "contributor", "redactions": [r.model_dump() for r in scan(text)], "flags": []}])
    s.ins("claims", [{"id": f"{sid}__cl_v", "handover_id": sid, "type": "fact", "statement": "Rohan is unreliable.",
                      "state": "verified", "confidence_reason": "", "workstream": "people", "entity_key": "people",
                      "owner": None, "label": "contributor", "review_status": "approved", "sensitive": False,
                      "section": "state", "date": None, "citations": [{"evidence_id": f"{sid}__ev_vendor",
                                                                       "quote": "Rohan has been unreliable", "support": "full"}],
                      "conflict_id": None, "version": 1, "confirmed_by": None, "confirmed_at": None, "method": "model"}])
    main.cache_clear()
    main.build_privacy_queue(sid)


def test_privacy_queue_lists_detectors_without_raw_values_and_escalation_hides_claim(api):
    c, s, sid = api
    _privacy_seed(s, sid)
    q = c.get(f"/handovers/{sid}/redactions", headers=L).json()
    names = {i["detector"]: i for i in q["items"]}
    assert names["pan"]["decision"] == "keep_masked" and names["people_sensitive"]["decision"] == "pending"
    assert {"upi_id", "pan", "people_sensitive"} <= set(names)
    assert "ABCPE1234F" not in str(q) and "okaxis" not in str(q)        # raw values never sent
    assert c.get(f"/handovers/{sid}/redactions", headers=C).status_code == 403
    # a pending judgement about a person blocks publishing until the reviewer decides
    c.post(f"/conflicts/{sid}__cf_1/resolve", headers=L, json={"action": "keep", "keep_claim_ids": [f"{sid}__cl_2"],
                                                              "note": "Commits since 2 Oct configure Vercel."})
    r = c.post(f"/handovers/{sid}/publish", headers=L)
    assert r.status_code == 400 and "privacy" in r.text.lower()
    pid = names["people_sensitive"]["id"]
    assert c.post(f"/redactions/{pid}/decide", headers=L, json={"decision": "escalate_lead_only"}).status_code == 400
    c.post(f"/redactions/{pid}/decide", headers=L, json={"decision": "escalate_lead_only", "reason": "HR matter, lead only"})
    assert s.one("claims", {"id": f"{sid}__cl_v"})["label"] == "lead_only"
    assert c.post(f"/handovers/{sid}/publish", headers=L).status_code == 200
    assert "unreliable" not in text_of(c.get(f"/handovers/{sid}/view", headers=C))
    # secrets can never be unmasked
    sec = next(i for i in c.get(f"/handovers/{sid}/redactions", headers=L).json()["items"] if i["kind"] == "secret") \
        if any(i["kind"] == "secret" for i in c.get(f"/handovers/{sid}/redactions", headers=L).json()["items"]) else None
    if sec:
        assert c.post(f"/redactions/{sec['id']}/decide", headers=L, json={"decision": "unmask", "reason": "testing"}).status_code == 400
