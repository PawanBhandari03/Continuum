"""Continuum API. Endpoints follow the contracts in web/lib/types.ts and web/lib/api.ts.
Auth (demo): the role arrives in the X-Demo-Role header; Supabase JWT auth replaces it later.
Permission decisions use visibility.py; Postgres RLS (migrations/0001) is a second layer."""
from __future__ import annotations
import json
import shutil
import tempfile
import threading
import zipfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import config
from .models import Claim, Conflict, EvidenceUnit, Gap, Redaction
from .protect import redact_text
from .store import Store
from .visibility import can_read, claim_visible, visible_claims
from .ingest import parse_chat_export, parse_notes
from .github import fetch_github
from . import pipeline

app = FastAPI(title="Continuum API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_store: Store | None = None
_provider = None
_lock = threading.Lock()

ROLES = ("lead", "contributor", "leaver")
ACTORS = {"lead": "Reviewer (lead)", "contributor": "Karan (successor)", "leaver": "Aditi (leaver)"}
SECTIONS = [("project", "Project in five lines"), ("state", "Current state by workstream"),
            ("decision_log", "Decision log"), ("first_week", "Your first week"),
            ("risks", "Risks and landmines"), ("dependencies", "Dependencies and people"),
            ("unresolved", "Still unresolved")]


def db() -> Store:
    global _store
    if _store is None:
        _store = Store()
    return _store


def provider():
    global _provider
    if _provider is None:
        from .gemini import GeminiProvider
        _provider = GeminiProvider()
    return _provider


def P(hid: str) -> str:
    """ID prefix keeping ids unique across handovers. The seeded demo handover h_1 is unprefixed."""
    return "" if hid == "h_1" else f"{hid}__"


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def role_of(x_demo_role: Optional[str]) -> str:
    r = (x_demo_role or "contributor").lower()
    if r not in ROLES:
        raise HTTPException(400, f"Unknown role '{r}'")
    return r


def need(role: str, *allowed: str) -> None:
    if role not in allowed:
        raise HTTPException(403, f"Your role ({role}) is not permitted to do this.")


# ---------------- row <-> model ----------------
def unit_row(u: EvidenceUnit, hid: str) -> dict:
    return {"id": u.id, "handover_id": hid, "source_id": u.source_id, "author": u.author, "ts": u.timestamp,
            "text": u.text, "locator": u.locator, "label": u.label,
            "redactions": [r.model_dump() for r in u.redactions]}


def to_unit(r: dict) -> EvidenceUnit:
    return EvidenceUnit(id=r["id"], source_id=r["source_id"], author=r["author"], timestamp=r["ts"],
                        text=r["text"], locator=r["locator"], label=r["label"],
                        redactions=[Redaction(**x) for x in (r.get("redactions") or [])])


def to_claim(r: dict) -> Claim:
    return Claim(**{k: v for k, v in r.items()})


def labels_of(hid: str) -> dict[str, EvidenceUnit]:
    rows = db().sel("evidence_units", {"handover_id": hid}, select="id,source_id,author,ts,text,locator,label")
    return {r["id"]: to_unit({**r, "redactions": []}) for r in rows}


def log_action(hid: str, actor: str, action: str, summary: str, claim_id: str | None = None,
               version: int | None = None, before=None, after=None) -> None:
    db().ins("review_actions", [{"handover_id": hid, "claim_id": claim_id, "actor": actor, "action": action,
                                 "before": before, "after": {**(after or {}), "summary": summary, "version": version}}])


def bump(hid: str, actor: str, action: str, summary: str, claim_id: str | None = None, before=None, after=None) -> int:
    h = get_handover_row(hid)
    v = h["version"] + 1
    db().upd("handovers", {"id": hid}, {"version": v})
    log_action(hid, actor, action, summary, claim_id, v, before, after)
    return v


def get_handover_row(hid: str) -> dict:
    h = db().one("handovers", {"id": hid})
    if not h:
        raise HTTPException(404, f"Handover {hid} not found")
    return h


def handover_out(h: dict) -> dict:
    return {k: h[k] for k in ("id", "leaver", "successor", "successor_role", "target_date", "status",
                              "version", "approved_by", "published_at")}


def claim_row(hid: str, cid: str) -> dict:
    r = db().one("claims", {"id": cid})
    if not r:
        raise HTTPException(404, f"Claim {cid} not found")
    return r


# ---------------- basic ----------------
@app.get("/health")
def health():
    return {"ok": True}


class NewHandover(BaseModel):
    leaver: str
    successor: str
    successor_role: str = "contributor"
    target_date: str


@app.get("/handovers")
def list_handovers():
    return [handover_out(h) for h in db().sel("handovers", order="created_at.asc") if not h["id"].endswith("_seed")]


@app.post("/handovers")
def create_handover(body: NewHandover):
    hid = f"h_{uuid.uuid4().hex[:8]}"
    db().ins("handovers", [{"id": hid, **body.model_dump()}])
    log_action(hid, "reviewer", "create", "Handover created.", version=1)
    return handover_out(get_handover_row(hid))


@app.get("/handovers/{hid}")
def get_handover(hid: str):
    return handover_out(get_handover_row(hid))


# ---------------- sources ----------------
SAMPLE_NAMES = {"chat-export/": "Team chat export (#general, #dev, #payments)"}


def ingest_sample(hid: str) -> None:
    manifest = json.loads((config.DEMO_DIR / "manifest.json").read_text(encoding="utf-8"))
    existing = {s["id"] for s in db().sel("sources", {"handover_id": hid}, select="id")}
    for s in manifest["sources"]:
        stem = "chat" if s["type"] == "chat_export" else Path(s["path"]).stem
        sid = f"{P(hid)}src_{stem}"
        if sid in existing:
            continue
        if s["type"] == "chat_export":
            units, rep = parse_chat_export(config.DEMO_DIR / s["path"], sid, s["default_label"])
        else:
            units, rep = parse_notes(config.DEMO_DIR / s["path"], sid, s["default_label"])
        for u in units:
            u.id = f"{P(hid)}{u.id}"
        label_note = " — lead only" if s["default_label"] == "lead_only" else ""
        name = SAMPLE_NAMES.get(s["path"]) or f"Notes: {Path(s['path']).name}{label_note}"
        db().ins("sources", [{"id": sid, "handover_id": hid, "type": s["type"], "name": name,
                              "status": rep["status"], "status_reason": rep.get("reason"),
                              "default_label": s["default_label"], "unit_count": len(units)}])
        db().ins("evidence_units", [unit_row(u, hid) for u in units])
    gid = f"{P(hid)}src_github"
    if gid not in existing:
        ingest_github(hid, SAMPLE_REPO, "CampusKart repo (README, commits, PRs, issues, TODOs)", gid)


SAMPLE_REPO = "https://github.com/PawanBhandari03/campuskart"


def ingest_github(hid: str, ref: str, name: str, sid: str) -> None:
    units, rep = fetch_github(ref, sid, "contributor", id_prefix=P(hid))
    db().ins("sources", [{"id": sid, "handover_id": hid, "type": "github", "name": name,
                          "status": rep["status"], "status_reason": rep.get("reason"),
                          "default_label": "contributor", "unit_count": len(units)}])
    if units:
        db().ins("evidence_units", [unit_row(u, hid) for u in units])


class NewSource(BaseModel):
    type: str
    name: str = ""
    ref: Optional[str] = None
    sample: bool = False


@app.get("/handovers/{hid}/sources")
def get_sources(hid: str, x_demo_role: Optional[str] = Header(None)):
    role = role_of(x_demo_role)
    rows = db().sel("sources", {"handover_id": hid}, order="id.asc")
    return [{"id": r["id"], "type": r["type"], "name": r["name"], "status": r["status"],
             "status_reason": r["status_reason"], "default_label": r["default_label"],
             "unit_count": r["unit_count"]} for r in rows if can_read(role, r["default_label"])]


@app.post("/handovers/{hid}/sources")
def add_source(hid: str, body: NewSource):
    get_handover_row(hid)
    if body.sample:
        ingest_sample(hid)
        return {"ok": True}
    sid = f"{hid}__src_{uuid.uuid4().hex[:6]}"
    if body.type == "github":
        ingest_github(hid, body.ref or "", body.name or (body.ref or "GitHub repo"), sid)
        return {"ok": True}
    reason = ("This source type is not wired to the live API in this build. Use the sample sources, "
              "or connect a GitHub repo.")
    db().ins("sources", [{"id": sid, "handover_id": hid, "type": body.type, "name": body.name or body.type,
                          "status": "failed", "status_reason": reason, "default_label": "contributor",
                          "unit_count": 0}])
    return {"ok": True}


MAX_UPLOAD = 25 * 1024 * 1024


@app.post("/handovers/{hid}/sources/upload")
async def upload_source(hid: str, type: str = Form(...), file: UploadFile = File(...),
                        label: str = Form("contributor"), x_demo_role: Optional[str] = Header(None)):
    """Upload a Slack export (.zip) or notes (.md/.txt/.pdf). Malformed files become a visible
    'failed'/'partial' source with a reason; they never crash the request."""
    role = role_of(x_demo_role)
    need(role, "lead")
    get_handover_row(hid)
    if type not in ("chat_export", "notes"):
        raise HTTPException(400, "type must be chat_export or notes")
    if label not in ("public", "contributor", "lead_only"):
        raise HTTPException(400, "bad label")
    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "File too large (25 MB max)")
    sid = f"{P(hid)}src_{uuid.uuid4().hex[:6]}"
    name = file.filename or type
    tmp = Path(tempfile.mkdtemp(prefix="upload_"))
    try:
        if type == "chat_export":
            zpath = tmp / "export.zip"
            zpath.write_bytes(data)
            root = tmp / "export"
            try:
                with zipfile.ZipFile(zpath) as z:
                    for m in z.namelist():  # reject path traversal
                        if m.startswith(("/", "\\")) or ".." in Path(m).parts:
                            raise ValueError("unsafe path in zip")
                    z.extractall(root)
                cands = [root, *[d for d in root.rglob("*") if d.is_dir()]]
                export_root = next((d for d in cands if (d / "users.json").exists()
                                    or (d / "channels.json").exists()), root)
                units, rep = parse_chat_export(export_root, sid, label)
            except (zipfile.BadZipFile, ValueError) as e:
                units, rep = [], {"status": "failed", "reason": f"Not a readable Slack export zip: {e}"}
        else:
            suffix = Path(name).suffix.lower()
            if suffix not in (".md", ".txt", ".pdf"):
                units, rep = [], {"status": "failed", "reason": f"Unsupported file type {suffix or '(none)'}; use .md, .txt or .pdf"}
            else:
                fpath = tmp / f"notes{suffix}"
                fpath.write_bytes(data)
                units, rep = parse_notes(fpath, sid, label)
        for u in units:  # unique per uploaded source, so two uploads can never collide
            u.id = f"{sid}__{u.id}"
        db().ins("sources", [{"id": sid, "handover_id": hid, "type": type, "name": name, "status": rep["status"],
                              "status_reason": rep.get("reason"), "default_label": label, "unit_count": len(units)}])
        if units:
            db().ins("evidence_units", [unit_row(u, hid) for u in units])
        bump(hid, ACTORS[role], "upload", f"Uploaded {name}: {rep['status']}, {len(units)} evidence units")
        return {"id": sid, "type": type, "name": name, "status": rep["status"], "status_reason": rep.get("reason"),
                "default_label": label, "unit_count": len(units)}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


@app.get("/handovers/{hid}/audit")
def audit(hid: str, x_demo_role: Optional[str] = Header(None)):
    need(role_of(x_demo_role), "lead")
    rows = db().sel("review_actions", {"handover_id": hid}, order="at.desc")
    return [{"at": r["at"], "actor": r["actor"], "action": r["action"],
             "summary": (r["after"] or {}).get("summary") or r["action"], "claim_id": r["claim_id"]} for r in rows]


# ---------------- reconstruct ----------------
def _prefix(hid, claims, conflicts, gaps):
    p = lambda x: f"{P(hid)}{x}" if x else x  # noqa: E731
    for c in claims:
        c.id, c.handover_id, c.conflict_id = p(c.id), hid, p(c.conflict_id)
    for cf in conflicts:
        cf.id, cf.claim_ids = p(cf.id), [p(x) for x in cf.claim_ids]
    for g in gaps:
        g.id, g.claim_id = p(g.id), p(g.claim_id)


def _set_job(job_id: str, **kw) -> None:
    db().upd("jobs", {"id": job_id}, kw)


def _reconstruct(hid: str, job_id: str) -> None:
    try:
        _set_job(job_id, status="running", stage="parse", progress=5)
        units = [to_unit(r) for r in db().sel("evidence_units", {"handover_id": hid})]
        if not units:
            raise RuntimeError("No evidence has been ingested. Connect sources first.")
        _set_job(job_id, stage="protect", progress=15)
        prov = provider()
        pub = [u for u in units if u.label != "lead_only"]
        lead = [u for u in units if u.label == "lead_only"]

        def stage(name):
            return lambda st, pct: _set_job(job_id, stage=st if st in ("extract", "verify", "conflicts_gaps") else name,
                                            progress=int({"extract": 20 + pct * 0.5, "conflicts_gaps": 75 + pct * 0.2}.get(st, 20)))
        # Permission before generation: two separate passes so lead-only text is never
        # blended into claims that cite public evidence.
        res = pipeline.run(pub, prov, role="contributor", on_stage=stage("extract"))
        claims, conflicts, gaps, errors = res.claims, res.conflicts, res.gaps, list(res.errors)
        if lead:
            r2 = pipeline.run(lead, prov, role="lead")
            errors += r2.errors
            for c in r2.claims:
                if c.type == "gap":
                    continue
                c.id = c.id.replace("cl_", "cl_L")
                c.conflict_id = c.conflict_id.replace("cf_", "cf_L") if c.conflict_id else None
                claims.append(c)
            for cf in r2.conflicts:
                cf.id = cf.id.replace("cf_", "cf_L")
                cf.claim_ids = [x.replace("cl_", "cl_L") for x in cf.claim_ids]
                conflicts.append(cf)
        if errors and not claims:
            raise RuntimeError("Model calls failed: " + "; ".join(errors)[:300])
        _prefix(hid, claims, conflicts, gaps)
        for t in ("claims", "conflicts", "gaps"):
            db().delete(t, {"handover_id": hid})
        db().ins("claims", [c.model_dump() for c in claims])
        db().ins("conflicts", [{**c.model_dump(), "handover_id": hid} for c in conflicts])
        db().ins("gaps", [{**g.model_dump(), "handover_id": hid} for g in gaps])
        db().upd("handovers", {"id": hid}, {"status": "in_review"})
        note = f"Reconstruction: {len(claims)} claims, {len(conflicts)} conflicts, {len(gaps)} gaps."
        if errors:
            note += f" {len(errors)} model call(s) failed; result may be incomplete."
        bump(hid, "system", "reconstruct", note)
        _set_job(job_id, status="done", stage=None, progress=100, error=("; ".join(errors)[:500] or None))
    except Exception as e:  # surfaced to the UI, never swallowed
        _set_job(job_id, status="failed", error=f"{type(e).__name__}: {e}"[:500])


# ---------------- stored demo run (snapshot / replay / reset) ----------------
SEED_PREFIX = "seed__"


def seed_id(hid: str) -> str:
    return f"{hid}_seed"


def _copy_set(src_hid: str, dst_hid: str, strip: str = "", add: str = "") -> tuple[int, int, int]:
    """Copy claims, conflicts and gaps between handovers, renaming ids (add/strip a prefix)."""
    ren = lambda x: (add + x[len(strip):] if strip and x.startswith(strip) else add + x) if x else x  # noqa: E731
    claims = db().sel("claims", {"handover_id": src_hid})
    conflicts = db().sel("conflicts", {"handover_id": src_hid})
    gaps = db().sel("gaps", {"handover_id": src_hid})
    for t in ("claims", "conflicts", "gaps"):
        db().delete(t, {"handover_id": dst_hid})
    rows = [{**c, "id": ren(c["id"]), "handover_id": dst_hid, "conflict_id": ren(c["conflict_id"])} for c in claims]
    db().ins("claims", rows)
    db().ins("conflicts", [{**c, "id": ren(c["id"]), "handover_id": dst_hid,
                            "claim_ids": [ren(x) for x in c["claim_ids"]]} for c in conflicts])
    db().ins("gaps", [{**g, "id": ren(g["id"]), "handover_id": dst_hid, "claim_id": ren(g["claim_id"])} for g in gaps])
    return len(claims), len(conflicts), len(gaps)


def has_snapshot(hid: str) -> bool:
    return bool(db().one("handovers", {"id": seed_id(hid)})) and bool(db().sel("claims", {"handover_id": seed_id(hid)}, select="id")[:1])


@app.post("/demo/snapshot")
def snapshot(hid: str = "h_1", x_demo_role: Optional[str] = Header(None)):
    """Save the CURRENT claims/conflicts/gaps of a handover as its stored run (used for replay/reset)."""
    need(role_of(x_demo_role), "lead")
    h = get_handover_row(hid)
    sid = seed_id(hid)
    if not db().one("handovers", {"id": sid}):
        db().ins("handovers", [{"id": sid, "leaver": h["leaver"], "successor": h["successor"],
                                "successor_role": h["successor_role"], "target_date": h["target_date"]}])
    n = _copy_set(hid, sid, add=SEED_PREFIX)
    return {"ok": True, "claims": n[0], "conflicts": n[1], "gaps": n[2]}


def _restore(hid: str) -> tuple[int, int, int]:
    n = _copy_set(seed_id(hid), hid, strip=SEED_PREFIX)
    db().upd("handovers", {"id": hid}, {"status": "in_review", "approved_by": None, "published_at": None})
    return n


@app.post("/handovers/{hid}/reset")
def reset_demo(hid: str, x_demo_role: Optional[str] = Header(None)):
    """Reset a demo handover to its stored reconstruction (clears review work, answers, acks, history)."""
    need(role_of(x_demo_role), "lead")
    get_handover_row(hid)
    if not has_snapshot(hid):
        raise HTTPException(400, "No stored snapshot for this handover.")
    for t in ("acknowledgements", "review_actions"):
        db().delete(t, {"handover_id": hid})
    exit_sid = f"{hid}__src_exit_qa"
    db().delete("evidence_units", {"source_id": exit_sid})
    db().delete("sources", {"id": exit_sid})
    n = _restore(hid)
    db().upd("handovers", {"id": hid}, {"version": 1})
    log_action(hid, "system", "reset", f"Demo reset to the stored reconstruction ({n[0]} claims).", version=1)
    return {"ok": True, "claims": n[0]}


def _replay(hid: str, job_id: str) -> None:
    import time
    try:
        for stage, pct in (("parse", 10), ("protect", 25), ("extract", 50), ("verify", 75), ("conflicts_gaps", 90)):
            _set_job(job_id, status="running", stage=stage, progress=pct)
            time.sleep(0.8)
        n = _restore(hid)
        bump(hid, "system", "reconstruct",
             f"Reconstruction replayed from a stored model run ({n[0]} claims, {n[1]} conflicts, {n[2]} gaps). "
             "Replayed to protect free-tier model quota; new handovers run the live pipeline.")
        _set_job(job_id, status="done", stage=None, progress=100, error=None)
    except Exception as e:
        _set_job(job_id, status="failed", error=f"{type(e).__name__}: {e}"[:500])


@app.post("/handovers/{hid}/reconstruct")
def reconstruct(hid: str, live: bool = False, x_demo_role: Optional[str] = Header(None)):
    need(role_of(x_demo_role), "lead")
    get_handover_row(hid)
    job_id = str(uuid.uuid4())
    db().ins("jobs", [{"id": job_id, "handover_id": hid, "status": "queued", "progress": 0}])
    target = _replay if (not live and has_snapshot(hid)) else _reconstruct
    threading.Thread(target=target, args=(hid, job_id), daemon=True).start()
    return {"job_id": job_id}


@app.get("/jobs/{job_id}")
def get_job(job_id: str):
    j = db().one("jobs", {"id": job_id})
    if not j:
        raise HTTPException(404, "Job not found")
    return {"status": j["status"], "stage": j["stage"], "progress": j["progress"], "error": j["error"]}


# ---------------- claims ----------------
@app.get("/handovers/{hid}/claims")
def get_claims(hid: str, state: Optional[str] = None, type: Optional[str] = None,
               workstream: Optional[str] = None, review_status: Optional[str] = None,
               x_demo_role: Optional[str] = Header(None)):
    role = role_of(x_demo_role)
    claims = [to_claim(r) for r in db().sel("claims", {"handover_id": hid}, order="id.asc")]
    if role != "lead":
        claims, _ = visible_claims(role, claims, labels_of(hid))
    return [c.model_dump() for c in claims
            if (not state or c.state == state) and (not type or c.type == type)
            and (not workstream or c.workstream == workstream)
            and (not review_status or c.review_status == review_status)]


class ClaimPatch(BaseModel):
    action: str
    edited_statement: Optional[str] = None
    note: Optional[str] = None


@app.patch("/claims/{cid}")
def patch_claim(cid: str, body: ClaimPatch, x_demo_role: Optional[str] = Header(None)):
    role = role_of(x_demo_role)
    need(role, "lead")
    actor = ACTORS[role]
    r = claim_row(None, cid)
    c = to_claim(r)
    before = {"statement": c.statement, "review_status": c.review_status, "sensitive": c.sensitive, "state": c.state}
    patch: dict = {"version": c.version + 1}
    if body.action == "approve":
        patch.update(review_status="approved", confirmed_by=actor, confirmed_at=now())
    elif body.action == "edit":
        if not (body.edited_statement or "").strip():
            raise HTTPException(400, "Edited statement cannot be empty")
        patch.update(statement=body.edited_statement.strip(), review_status="edited", confirmed_by=actor,
                     confirmed_at=now(), state="inferred" if c.state == "inferred" else "confirmed")
    elif body.action == "reject":
        patch.update(review_status="rejected")
    elif body.action == "redact":
        patch.update(review_status="redacted", sensitive=True)
    elif body.action == "mark_sensitive":
        patch.update(sensitive=not c.sensitive)
    else:
        raise HTTPException(400, f"Unsupported action {body.action}")
    db().upd("claims", {"id": cid}, patch)
    bump(r["handover_id"], actor, body.action,
         f"{body.action.replace('_', ' ')}: {cid.split('__')[-1]}" + (f" — {body.note}" if body.note else ""),
         cid, before, patch)
    return to_claim(claim_row(None, cid)).model_dump()


@app.get("/claims/{cid}/evidence")
def claim_evidence(cid: str, x_demo_role: Optional[str] = Header(None)):
    role = role_of(x_demo_role)
    c = to_claim(claim_row(None, cid))
    units = labels_of(c.handover_id)
    if role != "lead" and not claim_visible(role, c, units):
        raise HTTPException(403, "Not permitted: you cannot see this claim's evidence.")
    out = []
    for ci in c.citations:
        row = db().one("evidence_units", {"id": ci.evidence_id})
        if not row or not can_read(role, row["label"]):
            continue
        u = to_unit(row)
        src = db().one("sources", {"id": u.source_id})
        peers = sorted((to_unit(x) for x in db().sel("evidence_units", {"source_id": u.source_id}, order="ts.asc")
                        if can_read(role, x["label"])), key=lambda e: e.timestamp)
        i = next((k for k, e in enumerate(peers) if e.id == u.id), 0)

        def safe(e: EvidenceUnit) -> dict:  # secrets/PII never leave the API
            d = e.model_dump()
            d["text"], d["redactions"] = redact_text(e.text, e.redactions), []
            return d
        out.append({"citation": ci.model_dump(), "unit": safe(u),
                    "source": {"id": src["id"], "type": src["type"], "name": src["name"], "status": src["status"],
                               "status_reason": src["status_reason"], "default_label": src["default_label"],
                               "unit_count": src["unit_count"]},
                    "context": [safe(e) for e in peers[max(0, i - 2): i + 3]]})
    return out


# ---------------- conflicts, gaps ----------------
@app.get("/handovers/{hid}/conflicts")
def get_conflicts(hid: str):
    return [{k: r[k] for k in ("id", "claim_ids", "summary", "resolution", "resolved_by", "note")}
            for r in db().sel("conflicts", {"handover_id": hid}, order="id.asc")]


class Resolve(BaseModel):
    resolution: str
    note: str = ""
    keep_claim_id: Optional[str] = None


@app.post("/conflicts/{cfid}/resolve")
def resolve_conflict(cfid: str, body: Resolve, x_demo_role: Optional[str] = Header(None)):
    role = role_of(x_demo_role)
    need(role, "lead")
    actor = ACTORS[role]
    cf = db().one("conflicts", {"id": cfid})
    if not cf:
        raise HTTPException(404, "Conflict not found")
    if body.resolution not in ("resolved", "unresolved_followup"):
        raise HTTPException(400, "Choose resolved or unresolved_followup")
    if body.resolution == "resolved" and not body.note.strip():
        raise HTTPException(400, "A resolution note is required (who decided, why).")
    db().upd("conflicts", {"id": cfid}, {"resolution": body.resolution, "resolved_by": actor, "note": body.note})
    if body.resolution == "resolved" and body.keep_claim_id:
        for cid in cf["claim_ids"]:
            if cid == body.keep_claim_id:
                db().upd("claims", {"id": cid}, {"state": "confirmed", "confirmed_by": actor, "confirmed_at": now(),
                                                 "review_status": "approved", "conflict_id": None})
            else:
                db().upd("claims", {"id": cid}, {"review_status": "rejected"})
    bump(cf["handover_id"], actor, "resolve_conflict",
         f"Conflict {cfid.split('__')[-1]} → "
         f"{'resolved' if body.resolution == 'resolved' else 'marked unresolved (successor to follow up)'}")
    r = db().one("conflicts", {"id": cfid})
    return {k: r[k] for k in ("id", "claim_ids", "summary", "resolution", "resolved_by", "note")}


def gap_out(r: dict) -> dict:
    return {k: r[k] for k in ("id", "claim_id", "question", "evidence_found", "status", "answer",
                              "answer_evidence_id")}


@app.get("/handovers/{hid}/gaps")
def get_gaps(hid: str):
    return [gap_out(r) for r in db().sel("gaps", {"handover_id": hid}, order="id.asc")]


class Answer(BaseModel):
    answer: str = ""
    skip: bool = False


@app.post("/gaps/{gid}/answer")
def answer_gap(gid: str, body: Answer, x_demo_role: Optional[str] = Header(None)):
    role = role_of(x_demo_role)
    need(role, "lead", "leaver")
    actor = ACTORS[role]
    g = db().one("gaps", {"id": gid})
    if not g:
        raise HTTPException(404, "Gap not found")
    hid = g["handover_id"]
    if body.skip:
        db().upd("gaps", {"id": gid}, {"status": "skipped"})
        return gap_out(db().one("gaps", {"id": gid}))
    text = body.answer.strip()
    if not text:
        raise HTTPException(400, "Answer cannot be empty (use Skip instead).")
    sid = f"{hid}__src_exit_qa"
    if not db().one("sources", {"id": sid}):
        db().ins("sources", [{"id": sid, "handover_id": hid, "type": "exit_qa", "name": "Exit Q&A (leaver answers)",
                              "status": "ok", "default_label": "contributor", "unit_count": 0}])
    n = len(db().sel("evidence_units", {"source_id": sid}, select="id")) + 1
    evid = f"{hid}__ev_exitqa_{n}"
    db().ins("evidence_units", [{"id": evid, "handover_id": hid, "source_id": sid, "author": actor, "ts": now(),
                                 "text": text, "locator": f"exit-qa://{evid}", "label": "contributor",
                                 "redactions": []}])
    db().upd("sources", {"id": sid}, {"unit_count": n})
    db().upd("gaps", {"id": gid}, {"status": "answered", "answer": text, "answer_evidence_id": evid})
    c = to_claim(claim_row(None, g["claim_id"]))
    base = c.statement.rstrip(".")
    db().upd("claims", {"id": c.id}, {
        "statement": f'Answered by leaver: {base} — "{text}"', "state": "confirmed",
        "type": "fact" if c.type == "gap" else c.type,
        "citations": [x.model_dump() for x in c.citations] + [{"evidence_id": evid, "quote": text[:120], "support": "full"}],
        "confidence_reason": "Leaver's Exit Q&A answer (pending reviewer approval)",
        "confirmed_by": actor, "confirmed_at": now(), "review_status": "pending"})
    bump(hid, actor, "answer_gap", f"Gap {gid.split('__')[-1]} answered by leaver (new Exit Q&A evidence)")
    return gap_out(db().one("gaps", {"id": gid}))


# ---------------- readiness, versions, publish ----------------
@app.get("/handovers/{hid}/readiness")
def readiness(hid: str):
    from .analysis import compute_readiness
    claims = [to_claim(r) for r in db().sel("claims", {"handover_id": hid})
              if r["review_status"] != "rejected"]
    conflicts = [Conflict(**{k: r[k] for k in ("id", "claim_ids", "summary", "resolution", "resolved_by", "note")})
                 for r in db().sel("conflicts", {"handover_id": hid})]
    gaps = [Gap(**gap_out(r)) for r in db().sel("gaps", {"handover_id": hid})]
    return compute_readiness(claims, conflicts, gaps).model_dump()


@app.get("/handovers/{hid}/versions")
def versions(hid: str):
    rows = db().sel("review_actions", {"handover_id": hid}, order="at.desc")
    return [{"version": (r["after"] or {}).get("version") or 1, "at": r["at"], "actor": r["actor"],
             "summary": (r["after"] or {}).get("summary") or r["action"]} for r in rows]


@app.post("/handovers/{hid}/publish")
def publish(hid: str, x_demo_role: Optional[str] = Header(None)):
    role = role_of(x_demo_role)
    need(role, "lead")
    h = get_handover_row(hid)
    if h["status"] == "published":
        raise HTTPException(400, "Already published and locked.")
    reasons = []
    open_cf = [c for c in db().sel("conflicts", {"handover_id": hid}) if c["resolution"] == "open"]
    if open_cf:
        reasons.append(f"{len(open_cf)} conflict(s) unresolved. Resolve them or mark "
                       "\"unresolved — successor to follow up\".")
    pending = [c for c in db().sel("claims", {"handover_id": hid}, select="id,type,review_status")
               if c["review_status"] == "pending" and c["type"] != "gap"]
    if pending:
        reasons.append(f"{len(pending)} claim(s) have not been reviewed yet.")
    if reasons:
        raise HTTPException(400, " ".join(reasons))
    actor = ACTORS[role]
    db().upd("handovers", {"id": hid}, {"status": "published", "approved_by": actor, "published_at": now()})
    bump(hid, actor, "publish", "Published and locked this version.")
    return {"ok": True}


# ---------------- successor view + acknowledgements ----------------
@app.get("/handovers/{hid}/view")
def view(hid: str, x_demo_role: Optional[str] = Header(None)):
    role = role_of(x_demo_role)
    h = get_handover_row(hid)
    claims = [to_claim(r) for r in db().sel("claims", {"handover_id": hid}, order="id.asc")]
    units = labels_of(hid)
    acks: dict = {}
    for a in db().sel("acknowledgements", {"handover_id": hid}, order="at.asc"):
        acks[a["section"]] = a["status"]
    hidden, sections = 0, []
    for key, title in SECTIONS:
        inside = [c for c in claims if c.section == key and c.review_status != "rejected"]
        vis = [c for c in inside if (role == "lead" and c.review_status != "redacted")
               or (role != "lead" and claim_visible(role, c, units))]
        hidden += len(inside) - len(vis)
        sections.append({"key": key, "title": title, "claims": [c.model_dump() for c in vis],
                         "ack": acks.get(key, "none")})
    return {"handover": handover_out(h), "sections": sections, "hidden_count": 0 if role == "lead" else hidden}


class Ack(BaseModel):
    section: str
    status: str
    note: Optional[str] = None


@app.post("/handovers/{hid}/ack")
def ack(hid: str, body: Ack, x_demo_role: Optional[str] = Header(None)):
    role = role_of(x_demo_role)
    get_handover_row(hid)
    if body.status not in ("none", "acknowledged", "unclear"):
        raise HTTPException(400, "Bad status")
    actor = ACTORS[role]
    db().ins("acknowledgements", [{"handover_id": hid, "section": body.section, "status": body.status,
                                   "note": body.note, "actor": actor, "at": now()}], upsert=True)
    h = get_handover_row(hid)
    log_action(hid, actor, "ack" if body.status == "acknowledged" else "flag_unclear",
               f"{'Acknowledged' if body.status == 'acknowledged' else 'Flagged unclear'}: {body.section}"
               + (f" — {body.note}" if body.note else ""), version=h["version"])
    return {"ok": True}


# ---------------- demo seeding ----------------
@app.post("/demo/seed")
def seed_demo():
    """Create the CampusKart demo handover (h_1) with sample sources. Idempotent."""
    if not db().one("handovers", {"id": "h_1"}):
        db().ins("handovers", [{"id": "h_1", "leaver": "aditi", "successor": "karan",
                                "successor_role": "contributor", "target_date": "2026-11-30"}])
        log_action("h_1", "reviewer", "create", "Handover created.", version=1)
    ingest_sample("h_1")
    return {"ok": True, "handover_id": "h_1"}
