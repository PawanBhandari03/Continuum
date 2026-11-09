import json
from pathlib import Path

import pytest

from app.models import EvidenceUnit, RawClaim, RawCitation
from app.ingest import parse_chat_export, parse_notes, is_noise
from app.protect import scan, redact_text
from app.llm import FakeProvider
from app.pipeline import run
from app.visibility import filter_units, claim_visible
from app.verify import check_citations, build_claim

DEMO = Path(__file__).resolve().parents[2] / "demo-data"


def unit(i, text, label="contributor", author="aditi"):
    return EvidenceUnit(id=i, source_id="s", author=author, timestamp="2026-08-14T00:00:00+00:00",
                        text=text, locator=f"x://{i}", label=label)


# ---------- ingest ----------
def test_chat_export_parses_and_filters_noise():
    units, rep = parse_chat_export(DEMO / "chat-export")
    assert rep["status"] in ("ok", "partial") and len(units) > 100
    assert not any("Deploy succeeded" in u.text for u in units)  # bot messages dropped
    assert all(len(u.text) >= 8 for u in units)


def test_noise_rules():
    assert is_noise("ok") and is_noise("👍") and not is_noise("payments moved to UPI")


def test_missing_export_folder_is_failed_not_crash():
    units, rep = parse_chat_export(DEMO / "does-not-exist")
    assert units == [] and rep["status"] == "failed" and rep["reason"]


def test_malformed_day_file_makes_source_partial(tmp_path):
    (tmp_path / "dev").mkdir()
    (tmp_path / "dev" / "2026-01-01.json").write_text("{not json")
    (tmp_path / "dev" / "2026-01-02.json").write_text(json.dumps(
        [{"type": "message", "user": "U1", "text": "we decided to use postgres", "ts": "1786699027.000000"}]))
    units, rep = parse_chat_export(tmp_path)
    assert len(units) == 1 and rep["status"] == "partial" and "could not be read" in rep["reason"]


def test_empty_notes_failed(tmp_path):
    p = tmp_path / "n.md"
    p.write_text("")
    units, rep = parse_notes(p, "src_n")
    assert units == [] and rep["status"] == "failed"


def test_mentor_notes_secret_and_pii_redacted():
    units, rep = parse_notes(DEMO / "notes" / "mentor-notes.md", "src_mentor", "lead_only")
    assert units and all(u.label == "lead_only" for u in units)
    joined = " ".join(redact_text(u.text, u.redactions) for u in units)
    assert "sk_test_FAKE" not in joined and "+91-00000-00000" not in joined
    assert "[REDACTED SECRET]" in joined and "[REDACTED PII]" in joined


def test_scan_email():
    assert any(r.kind == "pii" for r in scan("mail me at someone@example.com now"))


# ---------- permissions ----------
def _units():
    return [unit("ev_pub", "Payments moved to UPI deep links because of merchant KYC", "contributor"),
            unit("ev_lead", "Dev often misses deadlines and needs closer supervision", "lead_only")]


RULES = [
    {"trigger": "upi deep links", "statement": "Payments moved to UPI.", "type": "decision",
     "workstream": "payments", "quote": "UPI deep links"},
    {"trigger": "closer supervision", "statement": "Dev needs supervision.", "type": "risk",
     "workstream": "people", "quote": "closer supervision"},
]


def test_contributor_view_never_sees_lead_only_evidence_or_model_input():
    seen = []

    class Spy(FakeProvider):
        def extract(self, units):
            seen.extend(u.id for u in units)
            return super().extract(units)

    res = run(_units(), Spy(RULES), role="contributor")
    assert "ev_lead" not in seen  # filtered BEFORE reaching the model
    assert not any("supervision" in c.statement for c in res.claims)


def test_lead_view_has_lead_only_claim_with_strict_label():
    res = run(_units(), FakeProvider(RULES), role="lead")
    risk = next(c for c in res.claims if c.type == "risk")
    assert risk.label == "lead_only"
    by_id = {u.id: u for u in _units()}
    assert not claim_visible("contributor", risk, by_id)
    assert claim_visible("lead", risk, by_id)


def test_claim_hidden_if_any_cited_evidence_is_restricted():
    by_id = {u.id: u for u in _units()}
    from app.models import Claim, Citation
    c = Claim(id="c", type="fact", statement="mixed", state="verified", label="contributor",
              citations=[Citation(evidence_id="ev_pub", quote="x"), Citation(evidence_id="ev_lead", quote="y")])
    assert not claim_visible("contributor", c, by_id)


# ---------- verification ----------
def test_valid_quote_gives_verified():
    res = run(_units(), FakeProvider(RULES), role="lead")
    pay = next(c for c in res.claims if c.type == "decision")
    assert pay.state == "verified" and pay.citations


def test_fabricated_quote_is_never_verified():
    u = {"ev1": unit("ev1", "We use Render for hosting the API")}
    raw = RawClaim(type="fact", statement="Deployed on Vercel", workstream="deploy",
                   citations=[RawCitation(evidence_id="ev1", quote="Deployed on Vercel production")])
    cites, problems = check_citations(raw, u, {"ev1"})
    assert cites == [] and problems
    assert build_claim(raw, "c1", cites, None, problems) is None  # dropped, not invented


def test_out_of_batch_id_rejected():
    u = {"ev1": unit("ev1", "We use Render for hosting the API")}
    raw = RawClaim(type="fact", statement="x", citations=[RawCitation(evidence_id="ev1", quote="We use Render")])
    cites, problems = check_citations(raw, u, set())
    assert cites == [] and "out-of-batch" in problems[0]


def test_partial_support_is_inferred_not_verified():
    raw = RawClaim(type="fact", statement="s", citations=[RawCitation(evidence_id="e", quote="q")])
    from app.models import Citation
    c = build_claim(raw, "c", [Citation(evidence_id="e", quote="q")], "partially", [])
    assert c.state == "inferred"


def test_inferred_claim_is_labelled():
    raw = RawClaim(type="risk", statement="Login may loop", inferred=True)
    c = build_claim(raw, "c", [], None, [])
    assert c.state == "inferred" and "AI inference" in c.statement


# ---------- conflicts, gaps, readiness ----------
def test_conflict_detected_and_not_auto_resolved():
    us = [unit("a", "README says we deploy on Render"), unit("b", "vercel config added, deploying there now")]
    rules = [{"trigger": "render", "statement": "Deploys on Render", "workstream": "deploy", "quote": "deploy on Render"},
             {"trigger": "vercel config", "statement": "Deploys on Vercel", "workstream": "deploy", "quote": "vercel config added"}]
    prov = FakeProvider(rules, {frozenset({"cl_1", "cl_2"})})
    res = run(us, prov, role="lead")
    assert len(res.conflicts) == 1 and res.conflicts[0].resolution == "open"
    assert {c.state for c in res.claims if c.workstream == "deploy"} == {"conflicting"}


def test_gaps_created_for_unfilled_slots_and_score_penalised():
    res = run([unit("a", "Payments moved to UPI deep links")], FakeProvider(RULES), role="lead")
    slots = {g.id for g in res.gaps}
    assert "gp_email" in slots and "gp_payments" not in slots
    assert res.readiness.slots_filled == 1 and res.readiness.score < 20 and res.readiness.formula


def test_provider_failure_is_reported_not_swallowed():
    class Boom(FakeProvider):
        def extract(self, units):
            raise TimeoutError("api timeout")

    res = run(_units(), Boom(RULES), role="lead")
    assert res.errors and "timeout" in res.errors[0].lower()


def test_real_demo_chat_through_pipeline_runs():
    units, _ = parse_chat_export(DEMO / "chat-export")
    res = run(units, FakeProvider([]), role="contributor")
    assert res.readiness is not None and res.gaps  # gaps surface when nothing is verified


# ---------- normalisation and dedup ----------
def test_entities_normalised_to_slots_and_duplicates_merged():
    from app.models import Claim, Citation
    from app.analysis import normalize_entities, dedup_claims
    a = Claim(id="a", type="dependency", statement="Verification emails use the college SMTP account",
              state="verified", entity_key="smtp", citations=[Citation(evidence_id="e1", quote="smtp")])
    b = Claim(id="b", type="dependency", statement="Sign-up verification emails use the college SMTP account.",
              state="verified", entity_key="mail", citations=[Citation(evidence_id="e2", quote="smtp")])
    normalize_entities([a, b])
    assert a.entity_key == "email" and b.entity_key == "email"
    merged = dedup_claims([a, b])
    assert len(merged) == 1 and {c.evidence_id for c in merged[0].citations} == {"e1", "e2"}


def test_dedup_keeps_different_facts_separate():
    from app.models import Claim
    from app.analysis import dedup_claims
    x = Claim(id="x", type="risk", statement="Search page is slow", state="verified")
    y = Claim(id="y", type="risk", statement="Avatar cropping is broken on profile page", state="verified")
    assert len(dedup_claims([x, y])) == 2


def test_dedup_never_merges_across_access_labels():
    from app.models import Claim
    from app.analysis import dedup_claims
    pub = Claim(id="p", type="risk", statement="Dev misses deadlines often", state="verified", label="contributor")
    lead = Claim(id="l", type="risk", statement="Dev misses deadlines often", state="verified", label="lead_only")
    out = dedup_claims([pub, lead])
    assert len(out) == 2 and {c.label for c in out} == {"contributor", "lead_only"}


# ---------- github connector (offline parts) and locators ----------
def test_github_ref_parsing_and_bad_refs():
    from app.github import parse_repo, GitHubError, fetch_github
    assert parse_repo("https://github.com/PawanBhandari03/campuskart") == ("PawanBhandari03", "campuskart")
    assert parse_repo("https://github.com/a/b.git") == ("a", "b")
    with pytest.raises(GitHubError):
        parse_repo("not a url")
    units, rep = fetch_github("not a url", "src_gh")
    assert units == [] and rep["status"] == "failed" and "parse" in rep["reason"].lower()


def test_simulated_date_used_when_present():
    from app.github import sim_date
    assert sim_date("body\n\nDate (simulated): 2026-08-14", "2026-11-09T00:00:00Z").startswith("2026-08-14")
    assert sim_date("no date here", "2026-11-09T00:00:00Z") == "2026-11-09T00:00:00Z"


def test_chat_locator_matches_web_chip_format():
    units, _ = parse_chat_export(DEMO / "chat-export")
    import re
    assert all(re.match(r"^slack://[a-z-]+/\d{4}-\d{2}-\d{2}#", u.locator) for u in units)
