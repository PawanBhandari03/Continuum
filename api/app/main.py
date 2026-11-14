"""Continuum API. Endpoints follow the contracts in web/lib/types.ts and docs/contracts.md.
Auth (demo): the role arrives in the X-Demo-Role header. Permission decisions use visibility.py and snapshots.py;
Postgres RLS (migrations 0001/0002) is a second layer for direct database access.

Round 3 model (docs/round3):
- handovers.version = latest PUBLISHED version (0 = never published); handovers.revision = draft edit counter.
- Publishing freezes a snapshot (handover_versions, SHA-256). Successors read snapshots, never the live draft.
- Every decision, view and export is appended to a hash-chained audit log (audit.py).
- Each demo visitor gets their own copy of the CampusKart handover (POST /demo/sandbox)."""
from __future__ import annotations
import csv
import io
import json
import shutil
import tempfile
import threading
import time
import uuid
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from . import audit, config, snapshots
from .models import Claim, Conflict, EvidenceUnit, Gap, Redaction, LABEL_RANK
from .protect import redact_text, scan
from .visibility import can_read, claim_visible, visible_claims
from .ingest import parse_chat_export, parse_notes
from .github import fetch_github
from . import pipeline

app = FastAPI(title="Continuum API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_store = None
_provider = None

ROLES = ("lead", "contributor", "leaver", "guest")
ACTORS = {"lead": "Reviewer (lead)", "contributor": "Karan (successor)", "leaver": "Aditi (leaver)",
          "guest": "Guest viewer"}
SECTIONS = snapshots.SECTIONS
TEMPLATE = "h_1"
SANDBOX_TTL_HOURS = 24


def db():
    global _store
    if _store is None:
        from .store import Store
        _store = Store()
    return _store


def use_store(store) -> None:
    """Tests: swap in an in-memory store."""
    global _store
    _store = store
    _cache.clear()
    audit.forget_cache()


def provider():
    """LLM_MODE: auto (model, falling back to rules call by call), model (model only), rules (no AI at all)."""
    global _provider
    if _provider is None:
        import os
        from .rules import FallbackProvider, RuleProvider
        mode = os.environ.get("LLM_MODE", "auto").lower()
        if mode == "rules":
            _provider = RuleProvider()
        else:
            try:
                from .gemini import GeminiProvider
                primary = GeminiProvider()
            except Exception:
                primary = None  # no key configured: rules only
            _provider = primary if mode == "model" else FallbackProvider(primary)
    return _provider


def ai_status() -> dict:
    p = provider()
    used = getattr(p, "used", None)
    if p.__class__.__name__ == "RuleProvider":
        mode, configured = "rules", False
    elif used is not None:
        mode, configured = "auto", getattr(p, "primary", None) is not None
    else:
        mode, configured = "model", True
    return {"mode": mode, "model_configured": configured, "calls": used or {},
            "recent_errors": getattr(p, "errors", [])[-3:]}


_cache: dict = {}
CACHE_TTL = 30.0


def cached(key, fn, ttl: float = CACHE_TTL):
    hit = _cache.get(key)
    if hit and hit[0] > time.monotonic():
        return hit[1]
    val = fn()
    _cache[key] = (time.monotonic() + ttl, val)
    return val


def cache_clear() -> None:
    """Call after any write to evidence/sources (ingest, upload, answers, reset)."""
    _cache.clear()


def units_all(hid: str) -> list[dict]:
    return cached(("units", hid), lambda: db().sel("evidence_units", {"handover_id": hid}))


def sources_all(hid: str) -> dict[str, dict]:
    return cached(("sources", hid), lambda: {r["id"]: r for r in db().sel("sources", {"handover_id": hid})})


def P(hid: str) -> str:
    """ID prefix keeping ids unique across handovers. The template demo handover h_1 is unprefixed."""
    return "" if hid == TEMPLATE else f"{hid}__"


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def short(x: str | None) -> str:
    return (x or "").split("__")[-1]


def role_of(x_demo_role: Optional[str]) -> str:
    r = (x_demo_role or "contributor").lower()
    if r not in ROLES:
        raise HTTPException(400, f"Unknown role '{r}'")
    return r


def need(role: str, *allowed: str) -> None:
    if role not in allowed:
        raise HTTPException(403, f"Your role ({role}) is not permitted to do this.")


def not_found(what: str = "Not found"):
    """Hidden things look exactly like missing things, so their existence is never revealed."""
    return HTTPException(404, what)


# ---------------- row <-> model ----------------
def unit_row(u: EvidenceUnit, hid: str) -> dict:
    return {"id": u.id, "handover_id": hid, "source_id": u.source_id, "author": u.author, "ts": u.timestamp,
            "text": u.text, "locator": u.locator, "label": u.label,
            "redactions": [r.model_dump() for r in u.redactions], "flags": list(u.flags)}


def to_unit(r: dict) -> EvidenceUnit:
    return EvidenceUnit(id=r["id"], source_id=r["source_id"], author=r["author"], timestamp=r["ts"],
                        text=r["text"], locator=r["locator"], label=r["label"],
                        redactions=[Redaction(**x) for x in (r.get("redactions") or [])],
                        flags=r.get("flags") or [])


CLAIM_FIELDS = set(Claim.model_fields)


def to_claim(r: dict) -> Claim:
    return Claim(**{k: v for k, v in r.items() if k in CLAIM_FIELDS})


def labels_of(hid: str) -> dict[str, EvidenceUnit]:
    return {r["id"]: to_unit({**r, "redactions": []}) for r in units_all(hid)}


def label_map(hid: str) -> dict[str, str]:
    return {r["id"]: r["label"] for r in units_all(hid)}


def log(hid: str, actor: str, action: str, summary: str, role: str = "", target_type: str | None = None,
        target_id: str | None = None, meta: dict | None = None, claim_id: str | None = None,
        before=None, after=None, revision: int | None = None) -> None:
    """Draft log (review_actions: per-claim before/after) + tamper-evident audit log."""
    db().ins("review_actions", [{"handover_id": hid, "claim_id": claim_id, "actor": actor, "action": action,
                                 "before": before,
                                 "after": {**(after or {}), "summary": summary, "revision": revision}}])
    audit.append(db(), hid, actor, action, summary, role=role,
                 target_type=target_type or ("claim" if claim_id else None), target_id=target_id or claim_id,
                 meta=meta)


def _par(*fns) -> None:
    """Run independent database calls at the same time (each is a network round trip)."""
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=max(1, len(fns))) as ex:
        for f in [ex.submit(fn) for fn in fns]:
            f.result()


def bump(hid: str, actor: str, action: str, summary: str, role: str = "lead", claim_id: str | None = None,
         before=None, after=None, also=(), target_type=None, target_id=None, meta=None) -> int:
    """A change to the draft: new draft revision + logs. If the latest version was published, the handover is
    now being edited towards the next version (successors keep reading the published snapshot)."""
    h = get_handover_row(hid)
    rev = (h.get("revision") or 1) + 1
    patch = {"revision": rev}
    if h["status"] == "published":
        patch["status"] = "in_review"
    _par(lambda: db().upd("handovers", {"id": hid}, patch), *also)
    log(hid, actor, action, summary, role=role, claim_id=claim_id, before=before, after=after, revision=rev,
        target_type=target_type, target_id=target_id, meta=meta)
    return rev


def get_handover_row(hid: str) -> dict:
    h = db().one("handovers", {"id": hid})
    if not h:
        raise not_found(f"Handover {hid} not found")
    return h


def handover_out(h: dict) -> dict:
    out = {k: h.get(k) for k in ("id", "leaver", "successor", "successor_role", "target_date", "status",
                                 "version", "approved_by", "published_at", "revision", "leaver_available")}
    out["is_demo"] = h["id"] == TEMPLATE or h.get("template_id") == TEMPLATE
    return out


def claim_row(cid: str) -> dict:
    r = db().one("claims", {"id": cid})
    if not r:
        raise not_found(f"Claim {cid} not found")
    return r


def claims_of(hid: str) -> list[dict]:
    return db().sel("claims", {"handover_id": hid}, order="id.asc")


def visible_live_claims(hid: str, role: str) -> list[Claim]:
    claims = [to_claim(r) for r in claims_of(hid)]
    if role == "lead":
        return claims
    return visible_claims(role, claims, labels_of(hid))[0]


# ---------------- basic ----------------
@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    return {"ok": True}


@app.get("/ai/status")
def get_ai_status():
    """Whether the AI model is configured and how many calls fell back to rules (shown on Reconstruct)."""
    return ai_status()


class NewHandover(BaseModel):
    leaver: str
    successor: str
    successor_role: str = "contributor"
    target_date: str


@app.get("/handovers")
def list_handovers(include: Optional[str] = None):
    """Real handovers plus (optionally) the caller's own demo copy. Other visitors' demo copies are not listed."""
    rows = db().sel("handovers", order="created_at.asc")
    return [handover_out(h) for h in rows if not h["id"].endswith("_seed")
            and (not h.get("template_id") or h["id"] == include)]


@app.post("/handovers")
def create_handover(body: NewHandover):
    hid = f"h_{uuid.uuid4().hex[:8]}"
    db().ins("handovers", [{"id": hid, **body.model_dump(), "version": 0, "revision": 1}])
    log(hid, "Reviewer (lead)", "create", "Handover created.", role="lead", target_type="handover", target_id=hid)
    return handover_out(get_handover_row(hid))


@app.get("/handovers/{hid}")
def get_handover(hid: str):
    return handover_out(get_handover_row(hid))


# ---------------- sources ----------------
SAMPLE_NAMES = {"chat-export/": "Team chat export (#general, #dev, #payments)"}
SAMPLE_REPO = "https://github.com/PawanBhandari03/campuskart"


def ingest_sample(hid: str) -> None:
    manifest = json.loads((config.DEMO_DIR / "manifest.json").read_text(encoding="utf-8"))
    existing = {s["id"] for s in db().sel("sources", {"handover_id": hid}, select="id")}
    cache_clear()
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


def ingest_github(hid: str, ref: str, name: str, sid: str) -> None:
    cache_clear()
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
def add_source(hid: str, body: NewSource, x_demo_role: Optional[str] = Header(None)):
    role = role_of(x_demo_role)
    need(role, "lead")
    get_handover_row(hid)
    if body.sample:
        ingest_sample(hid)
        build_privacy_queue(hid)
        return {"ok": True}
    sid = f"{hid}__src_{uuid.uuid4().hex[:6]}"
    if body.type == "github":
        ingest_github(hid, body.ref or "", body.name or (body.ref or "GitHub repo"), sid)
        build_privacy_queue(hid)
        log(hid, ACTORS[role], "connect", f"Connected GitHub repo {body.ref}", role=role, target_type="source",
            target_id=sid)
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
    cache_clear()
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
                units, rep = parse_notes(fpath, sid, label, display_name=name)
        for u in units:  # unique per uploaded source, so two uploads can never collide
            u.id = f"{sid}__{u.id}"
        db().ins("sources", [{"id": sid, "handover_id": hid, "type": type, "name": name, "status": rep["status"],
                              "status_reason": rep.get("reason"), "default_label": label, "unit_count": len(units)}])
        if units:
            db().ins("evidence_units", [unit_row(u, hid) for u in units])
            build_privacy_queue(hid)
        bump(hid, ACTORS[role], "upload", f"Uploaded {name}: {rep['status']}, {len(units)} evidence units",
             role=role, target_type="source", target_id=sid)
        return {"id": sid, "type": type, "name": name, "status": rep["status"], "status_reason": rep.get("reason"),
                "default_label": label, "unit_count": len(units)}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


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
                cf.label = "lead_only"
                conflicts.append(cf)
        if errors and not claims:
            raise RuntimeError("Model calls failed: " + "; ".join(errors)[:300])
        _prefix(hid, claims, conflicts, gaps)
        for t in ("claims", "conflicts", "gaps"):
            db().delete(t, {"handover_id": hid})
        db().ins("claims", [c.model_dump() for c in claims])
        db().ins("conflicts", [{**c.model_dump(), "handover_id": hid} for c in conflicts])
        db().ins("gaps", [{**g.model_dump(), "handover_id": hid} for g in gaps])
        for cf in conflicts:
            db().ins("conflict_events", [{"conflict_id": cf.id, "handover_id": hid, "actor": "system",
                                          "action": "detected", "payload": {"kind": cf.kind, "sides": cf.claim_ids}}])
        h = get_handover_row(hid)
        if h["status"] == "draft":
            db().upd("handovers", {"id": hid}, {"status": "in_review"})
        note = f"Reconstruction: {len(claims)} claims, {len(conflicts)} conflicts, {len(gaps)} gaps."
        used = getattr(prov, "used", None)
        if used and used.get("rules"):
            note += f" {used['rules']} step(s) answered by rules because the AI was unavailable."
        if errors:
            note += f" {len(errors)} model call(s) failed; result may be incomplete."
        bump(hid, "system", "reconstruct", note, role="system", target_type="handover", target_id=hid)
        _set_job(job_id, status="done", stage=None, progress=100, error=("; ".join(errors)[:500] or None))
    except Exception as e:  # surfaced to the UI, never swallowed
        _set_job(job_id, status="failed", error=f"{type(e).__name__}: {e}"[:500])


# ---------------- stored demo run, per-visitor copies, reset ----------------
SEED_PREFIX = "seed__"


def seed_id(hid: str) -> str:
    return f"{hid}_seed"


def template_of(hid: str) -> str:
    h = db().one("handovers", {"id": hid})
    return (h or {}).get("template_id") or hid


def _copy_claimset(src_hid: str, dst_hid: str, strip: str = "", add: str = "", ev_add: str = "") -> tuple[int, int, int]:
    """Copy claims, conflicts and gaps between handovers, renaming ids (strip/add a prefix) and, for demo copies,
    the evidence ids they cite (ev_add)."""
    ren = lambda x: (add + (x[len(strip):] if strip and x.startswith(strip) else x)) if x else x  # noqa: E731
    ev = lambda x: ev_add + x if x else x  # noqa: E731
    claims = db().sel("claims", {"handover_id": src_hid})
    conflicts = db().sel("conflicts", {"handover_id": src_hid})
    gaps = db().sel("gaps", {"handover_id": src_hid})
    for t in ("claims", "conflicts", "gaps"):
        db().delete(t, {"handover_id": dst_hid})
    rows = [{**c, "id": ren(c["id"]), "handover_id": dst_hid, "conflict_id": ren(c.get("conflict_id")),
             "citations": [{**ci, "evidence_id": ev(ci["evidence_id"])} for ci in (c.get("citations") or [])]}
            for c in claims]
    db().ins("claims", rows)
    db().ins("conflicts", [{**c, "id": ren(c["id"]), "handover_id": dst_hid,
                            "claim_ids": [ren(x) for x in c["claim_ids"]]} for c in conflicts])
    db().ins("gaps", [{**g, "id": ren(g["id"]), "handover_id": dst_hid, "claim_id": ren(g["claim_id"]),
                       "evidence_found": [ev(x) for x in (g.get("evidence_found") or [])]} for g in gaps])
    return len(claims), len(conflicts), len(gaps)


def has_snapshot(hid: str) -> bool:
    sid = seed_id(template_of(hid))
    return bool(db().one("handovers", {"id": sid})) and bool(db().sel("claims", {"handover_id": sid}, select="id")[:1])


@app.post("/demo/snapshot")
def snapshot_seed(hid: str = TEMPLATE, x_demo_role: Optional[str] = Header(None)):
    """Save the CURRENT claims/conflicts/gaps of a handover as its stored run (used for replay/reset)."""
    need(role_of(x_demo_role), "lead")
    h = get_handover_row(hid)
    sid = seed_id(hid)
    if not db().one("handovers", {"id": sid}):
        db().ins("handovers", [{"id": sid, "leaver": h["leaver"], "successor": h["successor"],
                                "successor_role": h["successor_role"], "target_date": h["target_date"]}])
    n = _copy_claimset(hid, sid, add=SEED_PREFIX)
    return {"ok": True, "claims": n[0], "conflicts": n[1], "gaps": n[2]}


def _restore(hid: str) -> tuple[int, int, int]:
    tpl = template_of(hid)
    n = _copy_claimset(seed_id(tpl), hid, strip=SEED_PREFIX, add=P(hid), ev_add="" if hid == tpl else P(hid))
    db().upd("handovers", {"id": hid}, {"status": "in_review", "approved_by": None, "published_at": None})
    fix_readme_date(hid)
    k = redetect_conflicts(hid)
    return n[0], k, n[2]


def redetect_conflicts(hid: str) -> int:
    """Re-run conflict detection on stored claims with the current deterministic rules (no AI call): one conflict
    per disagreement, history/preview statements excluded, documentation-vs-activity marked as staleness.
    A claim that drops out of a conflict becomes Inferred until a reviewer confirms it (its pre-conflict state
    was not stored, so we do not claim it was verified)."""
    from .analysis import detect_conflicts, _SECTION
    from .rules import RuleProvider
    rows = claims_of(hid)
    claims = [to_claim(r) for r in rows if r["type"] != "gap" and r["review_status"] not in ("rejected", "superseded")]
    was = {c.id for c in claims if c.state == "conflicting"}
    units = {u["id"]: to_unit(u) for u in units_all(hid)}
    for c in claims:
        if c.state == "conflicting":
            c.state, c.conflict_id = "inferred", None
    pubs = [c for c in claims if c.label != "lead_only"]
    leads = [c for c in claims if c.label == "lead_only"]
    found = detect_conflicts(pubs, RuleProvider(), units)
    for cf in detect_conflicts(leads, RuleProvider(), units):
        cf.id = cf.id.replace("cf_", "cf_L")
        for c in leads:
            if c.conflict_id and c.conflict_id.startswith("cf_") and c.id in cf.claim_ids:
                c.conflict_id = cf.id
        found.append(cf)
    p = P(hid)
    db().delete("conflicts", {"handover_id": hid})
    db().ins("conflicts", [{**cf.model_dump(), "id": p + cf.id, "handover_id": hid} for cf in found])
    now_in = {cid for cf in found for cid in cf.claim_ids}
    for c in claims:
        if c.id in now_in:
            cfid = next(p + cf.id for cf in found if c.id in cf.claim_ids)
            db().upd("claims", {"id": c.id}, {"state": "conflicting", "conflict_id": cfid, "section": "unresolved",
                                             "confidence_reason": "Conflicts with another claim; not auto-resolved"})
        elif c.id in was:
            db().upd("claims", {"id": c.id}, {
                "state": "inferred", "conflict_id": None, "section": _SECTION.get(c.type, "state"),
                "confidence_reason": "An earlier check flagged a disagreement; the current check found none. "
                                     "Shown as inference until a reviewer confirms it."})
    for cf in found:
        db().ins("conflict_events", [{"conflict_id": p + cf.id, "handover_id": hid, "actor": "system",
                                      "action": "detected", "payload": {"kind": cf.kind, "by": cf.detected_by}}])
    return len(found)


_readme_date: dict = {}


def fix_readme_date(hid: str) -> None:
    """Units ingested before the Round 3 date fix carry the ingest day as the README date; use the date of the
    README's last commit instead (looked up once)."""
    eid = f"{P(hid)}gh_readme"
    u = db().one("evidence_units", {"id": eid})
    if not u:
        return
    if "v" not in _readme_date:
        try:
            import httpx
            from .github import parse_repo
            owner, repo = parse_repo(SAMPLE_REPO)
            r = httpx.get(f"https://api.github.com/repos/{owner}/{repo}/commits", params={"path": "README.md", "per_page": 1},
                          headers={"User-Agent": "continuum-connector"}, timeout=20)
            _readme_date["v"] = r.json()[0]["commit"]["author"]["date"] if r.status_code == 200 and r.json() else None
        except Exception:
            _readme_date["v"] = None
    if _readme_date["v"] and u["ts"][:10] != _readme_date["v"][:10]:
        db().upd("evidence_units", {"id": eid}, {"ts": _readme_date["v"]})
        cache_clear()


DEMO_TABLES = ("acknowledgements", "review_actions", "tasks", "handover_versions", "redaction_reviews",
               "conflict_events")


def _wipe_review_state(hid: str) -> None:
    for t in DEMO_TABLES:
        db().delete(t, {"handover_id": hid})
    exit_sid = f"{hid}__src_exit_qa"
    db().delete("evidence_units", {"source_id": exit_sid})
    db().delete("sources", {"id": exit_sid})
    audit.reset(db(), hid)
    cache_clear()


def recompute_labels(hid: str) -> int:
    """A claim's label is the strictest label of the evidence it cites (and of the cited units' current labels).
    Run after any evidence relabel (demo setup, privacy escalation)."""
    labels = {u["id"]: u["label"] for u in db().sel("evidence_units", {"handover_id": hid}, select="id,label")}
    n = 0
    for c in db().sel("claims", {"handover_id": hid}, select="id,label,citations"):
        cited = [labels[x["evidence_id"]] for x in (c.get("citations") or []) if x["evidence_id"] in labels]
        new = max(cited, key=lambda l: LABEL_RANK[l]) if cited else c["label"]
        if new != c["label"]:
            db().upd("claims", {"id": c["id"]}, {"label": new})
            n += 1
    cache_clear()
    return n


def demo_labels(hid: str) -> None:
    """The CampusKart repo is public on GitHub, so its evidence is labelled public (what a Guest may read);
    chat stays contributor and the mentor notes stay lead-only."""
    gh = f"{P(hid)}src_github"
    db().upd("sources", {"id": gh}, {"default_label": "public"})
    db().upd("evidence_units", {"source_id": gh}, {"label": "public"})
    recompute_labels(hid)


DEMO_TASK = ("dependencies", "Who do I ask for the image bucket credentials before I change anything?",
             "Meera holds the bucket credentials. Ask her on #dev before changing upload settings.")


def seed_published(hid: str) -> None:
    """Judge-safe demo state (spec 02 P0.7): v1 already published, so every role has content on first click.
    v1 defers the conflicts (the judge settles them for v2), keeps the Gap Interview question open and has one
    successor question already answered by the leaver, waiting for the reviewer."""
    lead = ACTORS["lead"]
    pending = [r["id"] for r in db().sel("claims", {"handover_id": hid}, select="id,type,review_status")
               if r["review_status"] == "pending" and r["type"] != "gap"]
    if pending:
        db().upd_in("claims", pending, {"review_status": "approved", "confirmed_by": lead, "confirmed_at": now()})
    for cf in db().sel("conflicts", {"handover_id": hid}):
        if cf["resolution"] == "open":
            db().upd("conflicts", {"id": cf["id"]}, {"resolution": "deferred", "resolved_by": lead, "decided_at": now(),
                                                    "note": "Deferred in v1: not confirmed before the first publish."})
    db().upd("handovers", {"id": hid}, {"version": 0, "revision": 1, "status": "in_review"})
    log(hid, "system", "reset", "Demo prepared: stored reconstruction loaded.", role="system",
        target_type="handover", target_id=hid)
    _publish(hid, lead, "lead", note="v1 (demo starting point)")
    section, question, answer = DEMO_TASK
    tid = f"{P(hid)}task_1"
    db().ins("tasks", [{"id": tid, "handover_id": hid, "kind": "unclear_flag", "section": section, "text": question,
                        "raised_by": ACTORS["contributor"], "raised_role": "contributor", "assigned_to": "both",
                        "version_raised": 1}])
    db().ins("acknowledgements", [{"handover_id": hid, "section": section, "status": "unclear", "note": question,
                                   "actor": ACTORS["contributor"], "version": 1}], upsert=True)
    evid = _add_exit_qa(hid, ACTORS["leaver"], answer)
    db().upd("tasks", {"id": tid}, {"status": "answered", "answer": answer, "answer_by": ACTORS["leaver"],
                                    "answer_evidence_id": evid, "updated_at": now()})
    audit.append(db(), hid, ACTORS["contributor"], "flag_unclear", f"Flagged unclear: {section} — {question}",
                 role="contributor", target_type="task", target_id=tid)
    audit.append(db(), hid, ACTORS["leaver"], "answer_task", "Answered the successor's question (new Exit Q&A evidence)",
                 role="leaver", target_type="task", target_id=tid)


@app.post("/handovers/{hid}/reset")
def reset_demo(hid: str, x_demo_role: Optional[str] = Header(None)):
    """Reset a demo handover (the template or a visitor's copy) to the judge-safe starting state."""
    need(role_of(x_demo_role), "lead")
    h = get_handover_row(hid)
    if hid != TEMPLATE and h.get("template_id") != TEMPLATE:
        raise HTTPException(400, "Only demo handovers can be reset.")
    if not has_snapshot(hid):
        raise HTTPException(400, "No stored snapshot for this handover.")
    _wipe_review_state(hid)
    n = _restore(hid)
    demo_labels(hid)
    build_privacy_queue(hid)
    seed_published(hid)
    return {"ok": True, "claims": n[0]}


def _cleanup_sandboxes() -> None:
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=SANDBOX_TTL_HOURS)).isoformat()
    for h in db().sel("handovers", {"template_id": TEMPLATE, "created_at": f"lt.{cutoff}"}, select="id"):
        db().delete("handovers", {"id": h["id"]})  # cascades to its sources, evidence, claims, versions…


@app.post("/demo/sandbox")
def create_sandbox():
    """Give this visitor their own copy of the CampusKart demo, so judges never see each other's changes."""
    tpl = get_handover_row(TEMPLATE)
    if not has_snapshot(TEMPLATE):
        raise HTTPException(503, "Demo template is not ready.")
    try:
        _cleanup_sandboxes()
    except Exception:
        pass  # cleanup is best effort
    hid = f"h_demo_{uuid.uuid4().hex[:8]}"
    p = P(hid)
    db().ins("handovers", [{"id": hid, "leaver": tpl["leaver"], "successor": tpl["successor"],
                            "successor_role": tpl["successor_role"], "target_date": tpl["target_date"],
                            "template_id": TEMPLATE, "status": "in_review", "version": 0, "revision": 1}])
    srcs = [s for s in db().sel("sources", {"handover_id": TEMPLATE}) if s["type"] != "exit_qa"]
    db().ins("sources", [{**s, "id": p + s["id"], "handover_id": hid} for s in srcs])
    keep = {s["id"] for s in srcs}
    units = [u for u in db().sel("evidence_units", {"handover_id": TEMPLATE}) if u["source_id"] in keep]
    db().ins("evidence_units", [{**u, "id": p + u["id"], "source_id": p + u["source_id"], "handover_id": hid}
                                for u in units])
    _restore(hid)
    demo_labels(hid)
    build_privacy_queue(hid)
    seed_published(hid)
    return {"handover_id": hid}


def _replay(hid: str, job_id: str) -> None:
    try:
        for stage, pct in (("parse", 10), ("protect", 25), ("extract", 50), ("verify", 75), ("conflicts_gaps", 90)):
            _set_job(job_id, status="running", stage=stage, progress=pct)
            time.sleep(0.8)
        n = _restore(hid)
        bump(hid, "system", "reconstruct",
             f"Reconstruction replayed from a stored model run ({n[0]} claims, {n[1]} conflicts, {n[2]} gaps). "
             "Replayed to protect free-tier model quota; new handovers run the live pipeline.", role="system",
             target_type="handover", target_id=hid)
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
def get_job(job_id: str, x_demo_role: Optional[str] = Header(None)):
    need(role_of(x_demo_role), "lead")
    j = db().one("jobs", {"id": job_id})
    if not j:
        raise not_found("Job not found")
    return {"status": j["status"], "stage": j["stage"], "progress": j["progress"], "error": j["error"]}


# ---------------- claims ----------------
@app.get("/handovers/{hid}/claims")
def get_claims(hid: str, state: Optional[str] = None, type: Optional[str] = None,
               workstream: Optional[str] = None, review_status: Optional[str] = None,
               x_demo_role: Optional[str] = Header(None)):
    role = role_of(x_demo_role)
    claims = visible_live_claims(hid, role)
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
    r = claim_row(cid)
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
    bump(r["handover_id"], actor, body.action,
         f"{body.action.replace('_', ' ')}: {short(cid)}" + (f" — {body.note}" if body.note else ""),
         role, cid, before, patch, also=(lambda: db().upd("claims", {"id": cid}, patch),))
    return to_claim({**r, **patch}).model_dump()


class BulkReview(BaseModel):
    action: str = "approve"
    state: Optional[str] = None          # e.g. "verified": only claims in this evidence state
    ids: Optional[list[str]] = None      # or an explicit list


@app.post("/handovers/{hid}/claims/bulk")
def bulk_review(hid: str, body: BulkReview, x_demo_role: Optional[str] = Header(None)):
    """Approve many pending claims with a handful of requests (one revision, one audit row)."""
    role = role_of(x_demo_role)
    need(role, "lead")
    if body.action != "approve":
        raise HTTPException(400, "Only bulk approve is supported.")
    get_handover_row(hid)
    actor = ACTORS[role]
    rows = db().sel("claims", {"handover_id": hid}, select="id,state,review_status")
    todo = [r["id"] for r in rows if r["review_status"] == "pending"
            and (not body.state or r["state"] == body.state) and (body.ids is None or r["id"] in set(body.ids))]
    if todo:
        patch = {"review_status": "approved", "confirmed_by": actor, "confirmed_at": now()}
        what = f"{body.state} " if body.state else ""
        bump(hid, actor, "approve", f"approve: {len(todo)} {what}claims (bulk)", role, None, None, {"count": len(todo)},
             also=(lambda: db().upd_in("claims", todo, patch),), target_type="claims", meta={"count": len(todo)})
    return {"approved": len(todo)}


_seen: dict = {}


def log_view(hid: str, role: str, action: str, target_type: str, target_id: str, summary: str) -> None:
    """Views are audited too (once per person, item and 10 minutes, so reading does not flood the log)."""
    key = (hid, role, action, target_id)
    t = time.monotonic()
    if _seen.get(key, 0) > t:
        return
    _seen[key] = t + 600
    try:
        audit.append(db(), hid, ACTORS.get(role, role), action, summary, role=role, target_type=target_type,
                     target_id=target_id)
    except Exception:
        pass  # a failed view log never blocks reading


@app.get("/claims/{cid}/evidence")
def claim_evidence(cid: str, x_demo_role: Optional[str] = Header(None)):
    role = role_of(x_demo_role)
    c = to_claim(claim_row(cid))
    rows = units_all(c.handover_id)
    by_id = {r["id"]: r for r in rows}
    if role != "lead" and not claim_visible(role, c, {k: to_unit({**v, "redactions": []}) for k, v in by_id.items()}):
        raise not_found(f"Claim {cid} not found")
    srcs = sources_all(c.handover_id)

    def safe(e: EvidenceUnit) -> dict:  # secrets/PII never leave the API
        d = e.model_dump()
        d["text"], d["redactions"] = redact_text(e.text, e.redactions), []
        return d
    out = []
    for ci in c.citations:
        row = by_id.get(ci.evidence_id)
        if not row or not can_read(role, row["label"]):
            continue
        u = to_unit(row)
        src = srcs.get(u.source_id)
        if not src:
            continue
        if role == "guest":
            peers = [u]  # guests see the cited unit only, no surrounding conversation
        else:
            peers = sorted((to_unit(x) for x in rows if x["source_id"] == u.source_id and can_read(role, x["label"])),
                           key=lambda e: e.timestamp)
        i = next((k for k, e in enumerate(peers) if e.id == u.id), 0)
        out.append({"citation": ci.model_dump(), "unit": safe(u),
                    "source": {"id": src["id"], "type": src["type"], "name": src["name"], "status": src["status"],
                               "status_reason": src["status_reason"], "default_label": src["default_label"],
                               "unit_count": src["unit_count"]},
                    "context": [safe(e) for e in peers[max(0, i - 2): i + 3]]})
    if role != "lead":
        log_view(c.handover_id, role, "view_evidence", "claim", cid, f"Opened the sources of claim {short(cid)}")
    return out


# ---------------- conflicts (Improvement 1) ----------------
def _conflict_label(cf: dict, claims: dict[str, dict]) -> str:
    labels = [claims[x]["label"] for x in cf["claim_ids"] if x in claims] + [cf.get("label") or "contributor"]
    return max(labels, key=lambda l: LABEL_RANK[l])


def _side(c: dict, units: dict[str, dict], srcs: dict[str, dict]) -> dict:
    ev = []
    for ci in c.get("citations") or []:
        u = units.get(ci["evidence_id"])
        if not u:
            continue
        s = srcs.get(u["source_id"], {})
        ev.append({"evidence_id": u["id"], "source_name": s.get("name"), "source_type": s.get("type"),
                   "author": u["author"], "ts": u["ts"], "quote": ci["quote"], "locator": u["locator"]})
    return {"claim": to_claim(c).model_dump(), "evidence": ev}


def conflict_out(cf: dict, claims: dict[str, dict] | None = None, units=None, srcs=None) -> dict:
    out = {k: cf.get(k) for k in ("id", "claim_ids", "summary", "resolution", "resolved_by", "note", "entity_key",
                                  "kind", "severity", "detected_by", "resolution_claim_id", "decided_at")}
    if claims is not None:
        out["label"] = _conflict_label(cf, claims)
        out["sides"] = [_side(claims[x], units, srcs) for x in cf["claim_ids"] if x in claims]
    return out


@app.get("/handovers/{hid}/conflicts")
def get_conflicts(hid: str, x_demo_role: Optional[str] = Header(None)):
    """Lead: every conflict with both sides and their evidence. Others: only conflicts whose every side they
    may see (a conflict involving lead-only evidence is invisible to them)."""
    role = role_of(x_demo_role)
    claims = {c["id"]: c for c in claims_of(hid)}
    units = {u["id"]: u for u in units_all(hid)}
    srcs = sources_all(hid)
    rows = db().sel("conflicts", {"handover_id": hid}, order="id.asc")
    if role != "lead":
        vis = {c.id for c in visible_live_claims(hid, role)}
        rows = [cf for cf in rows if all(x in vis for x in cf["claim_ids"])
                and can_read(role, _conflict_label(cf, claims))]
    return [conflict_out(cf, claims, units, srcs) for cf in rows]


@app.get("/conflicts/{cfid}/history")
def conflict_history(cfid: str, x_demo_role: Optional[str] = Header(None)):
    need(role_of(x_demo_role), "lead")
    return [{k: r.get(k) for k in ("at", "actor", "action", "note", "payload")}
            for r in db().sel("conflict_events", {"conflict_id": cfid}, order="at.asc")]


class Resolve(BaseModel):
    action: Optional[str] = None                 # keep | both_true | correct | defer | reopen
    resolution: Optional[str] = None             # Round 2 clients: resolved | unresolved_followup
    note: str = ""
    keep_claim_ids: Optional[list[str]] = None
    keep_claim_id: Optional[str] = None
    scope_note: Optional[str] = None
    corrected_statement: Optional[str] = None


RESULT = {"keep": "kept", "both_true": "both_true", "correct": "corrected", "defer": "deferred"}


@app.post("/conflicts/{cfid}/resolve")
def resolve_conflict(cfid: str, body: Resolve, x_demo_role: Optional[str] = Header(None)):
    role = role_of(x_demo_role)
    need(role, "lead")
    actor = ACTORS[role]
    cf = db().one("conflicts", {"id": cfid})
    if not cf:
        raise not_found("Conflict not found")
    hid = cf["handover_id"]
    action = body.action or {"resolved": "keep", "unresolved_followup": "defer"}.get(body.resolution or "", "")
    keep = body.keep_claim_ids or ([body.keep_claim_id] if body.keep_claim_id else [])
    note = body.note.strip()
    if action not in ("keep", "both_true", "correct", "defer", "reopen"):
        raise HTTPException(400, "Choose keep, both_true, correct, defer or reopen.")
    if action == "reopen":
        return _reopen(cf, actor, role)
    if cf["resolution"] not in ("open", "deferred"):
        raise HTTPException(409, f"Already settled by {cf.get('resolved_by')}. Reopen it first to change the decision.")
    if action == "defer":
        note = note or "Deferred: the successor should follow this up."
    elif len(note) < 10:
        raise HTTPException(400, "Write a reason of at least 10 characters (who confirmed it and why).")
    sides = {c["id"]: c for c in db().sel("claims", {"handover_id": hid}) if c["id"] in cf["claim_ids"]}
    if action == "keep" and (not keep or any(k not in sides for k in keep)):
        raise HTTPException(400, "Choose which side to keep.")
    if action == "both_true" and not (body.scope_note or "").strip():
        raise HTTPException(400, "Explain how both are true (scope), e.g. 'Render hosts the API, Vercel the web app'.")
    if action == "correct" and not (body.corrected_statement or "").strip():
        raise HTTPException(400, "Write the correct version.")

    prior = {cid: {k: c.get(k) for k in ("state", "review_status", "conflict_id", "confirmed_by", "confirmed_at",
                                         "section", "confidence_reason")} for cid, c in sides.items()}
    res_id = None
    stamp = {"confirmed_by": actor, "confirmed_at": now()}
    reason = f"Conflict settled by {actor}: {note}"
    if action == "keep":
        for cid, c in sides.items():
            if cid in keep:
                db().upd("claims", {"id": cid}, {"state": "confirmed", "review_status": "approved", "conflict_id": None,
                                                 "confidence_reason": reason,
                                                 "section": "state" if c.get("section") == "unresolved" else c.get("section"),
                                                 **stamp})
            else:
                db().upd("claims", {"id": cid}, {"review_status": "superseded"})
    elif action in ("both_true", "correct"):
        statement = (body.scope_note if action == "both_true" else body.corrected_statement).strip()
        first = next(iter(sides.values()))
        res_id = f"{P(hid)}cl_res_{short(cfid)}"
        cites = []
        for c in sides.values():
            cites += [x for x in (c.get("citations") or []) if x["evidence_id"] not in {y["evidence_id"] for y in cites}]
        new = Claim(id=res_id, handover_id=hid, type=first["type"], statement=statement, state="confirmed",
                    confidence_reason=reason, workstream=first["workstream"], entity_key=first["entity_key"],
                    label=max((c["label"] for c in sides.values()), key=lambda l: LABEL_RANK[l]),
                    review_status="approved", section="state", citations=cites, method="human", **stamp)
        db().ins("claims", [new.model_dump()], upsert=True)
        for cid in sides:
            db().upd("claims", {"id": cid}, {"review_status": "superseded"})
    db().upd("conflicts", {"id": cfid}, {"resolution": RESULT[action], "resolved_by": actor, "note": note,
                                        "decided_at": now(), "resolution_claim_id": res_id})
    db().ins("conflict_events", [{"conflict_id": cfid, "handover_id": hid, "actor": actor, "action": RESULT[action],
                                  "note": note, "payload": {"keep": keep, "prior": prior, "resolution_claim_id": res_id,
                                                            "statement": body.scope_note or body.corrected_statement}}])
    # Round 2 data may hold the same disagreement as several pairs: settle overlapping open ones together.
    mine = set(cf["claim_ids"])
    for o in db().sel("conflicts", {"handover_id": hid}):
        if o["id"] != cfid and o["resolution"] in ("open", "deferred") and mine & set(o["claim_ids"]) and action != "defer":
            db().upd("conflicts", {"id": o["id"]}, {"resolution": RESULT[action], "resolved_by": actor, "decided_at": now(),
                                                    "note": f"{note} (same disagreement as {short(cfid)})"})
    words = {"keep": "settled: kept " + ", ".join(short(k) for k in keep), "both_true": "settled: both true",
             "correct": "settled: corrected", "defer": "deferred to the successor"}[action]
    bump(hid, actor, "resolve_conflict", f"Conflict {short(cfid)} {words}. Reason: {note}", role,
         target_type="conflict", target_id=cfid)
    return _conflict_by_id(cfid)


def _conflict_by_id(cfid: str) -> dict:
    cf = db().one("conflicts", {"id": cfid})
    hid = cf["handover_id"]
    claims = {c["id"]: c for c in claims_of(hid)}
    return conflict_out(cf, claims, {u["id"]: u for u in units_all(hid)}, sources_all(hid))


def _reopen(cf: dict, actor: str, role: str) -> dict:
    if cf["resolution"] == "open":
        raise HTTPException(400, "This conflict is already open.")
    events = [e for e in db().sel("conflict_events", {"conflict_id": cf["id"]}, order="at.asc")
              if e["action"] in ("kept", "both_true", "corrected", "deferred")]
    prior = (events[-1]["payload"] or {}).get("prior", {}) if events else {}
    for cid, st in prior.items():
        db().upd("claims", {"id": cid}, st)
    if cf.get("resolution_claim_id"):
        db().delete("claims", {"id": cf["resolution_claim_id"]})
    db().upd("conflicts", {"id": cf["id"]}, {"resolution": "open", "resolved_by": None, "note": None,
                                            "decided_at": None, "resolution_claim_id": None})
    db().ins("conflict_events", [{"conflict_id": cf["id"], "handover_id": cf["handover_id"], "actor": actor,
                                  "action": "reopened", "payload": {}}])
    bump(cf["handover_id"], actor, "reopen_conflict", f"Conflict {short(cf['id'])} reopened", role,
         target_type="conflict", target_id=cf["id"])
    return _conflict_by_id(cf["id"])


# ---------------- gaps + Exit Q&A ----------------
def gap_out(r: dict) -> dict:
    return {k: r.get(k) for k in ("id", "claim_id", "question", "evidence_found", "status", "answer",
                                  "answer_evidence_id")}


@app.get("/handovers/{hid}/gaps")
def get_gaps(hid: str, with_evidence: bool = False, x_demo_role: Optional[str] = Header(None)):
    role = role_of(x_demo_role)
    need(role, "lead", "leaver", "contributor")
    rows = db().sel("gaps", {"handover_id": hid}, order="id.asc")
    if role != "lead":
        vis = {c.id for c in visible_live_claims(hid, role)}
        rows = [g for g in rows if g["claim_id"] in vis]
    out = [gap_out(r) for r in rows]
    if with_evidence:
        units = {u["id"]: u for u in units_all(hid)}
        srcs = sources_all(hid)
        for g in out:
            g["evidence"] = [{"id": u["id"], "author": u["author"], "ts": u["ts"], "locator": u["locator"],
                              "source_name": srcs.get(u["source_id"], {}).get("name"),
                              "text": redact_text(u["text"], [Redaction(**x) for x in (u.get("redactions") or [])])}
                             for u in (units.get(x) for x in g["evidence_found"] or [])
                             if u and can_read(role, u["label"])]
    return out


SECRET_MSG = "This looks like a password or key. Please do not paste secrets: say who holds it instead."


def _add_exit_qa(hid: str, actor: str, text: str) -> str:
    """Store a leaver answer as new citable evidence. Secrets are refused; personal data is masked."""
    spans = scan(text)
    if any(s.kind == "secret" for s in spans):
        raise HTTPException(400, SECRET_MSG)
    sid = f"{hid}__src_exit_qa"
    if not db().one("sources", {"id": sid}):
        db().ins("sources", [{"id": sid, "handover_id": hid, "type": "exit_qa", "name": "Exit Q&A (leaver answers)",
                              "status": "ok", "default_label": "contributor", "unit_count": 0}])
    n = len(db().sel("evidence_units", {"source_id": sid}, select="id")) + 1
    evid = f"{hid}__ev_exitqa_{n}"
    db().ins("evidence_units", [{"id": evid, "handover_id": hid, "source_id": sid, "author": actor, "ts": now(),
                                 "text": text, "locator": f"exit-qa://{evid}", "label": "contributor",
                                 "redactions": [s.model_dump() for s in spans], "flags": []}])
    db().upd("sources", {"id": sid}, {"unit_count": n})
    cache_clear()
    return evid


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
        raise not_found("Gap not found")
    hid = g["handover_id"]
    if body.skip:
        db().upd("gaps", {"id": gid}, {"status": "skipped"})
        audit.append(db(), hid, actor, "skip_gap", f"Gap {short(gid)} skipped", role=role, target_type="gap",
                     target_id=gid)
        return gap_out(db().one("gaps", {"id": gid}))
    text = body.answer.strip()
    if not text:
        raise HTTPException(400, "Answer cannot be empty (use Skip instead).")
    evid = _add_exit_qa(hid, actor, text)
    db().upd("gaps", {"id": gid}, {"status": "answered", "answer": text, "answer_evidence_id": evid})
    c = to_claim(claim_row(g["claim_id"]))
    base = c.statement.rstrip(".")
    shown = redact_text(text, scan(text))
    new_statement = f'Answered by leaver: {base} — "{shown}"'
    db().upd("claims", {"id": c.id}, {
        "statement": new_statement, "state": "confirmed",
        "type": "fact" if c.type == "gap" else c.type,
        "citations": [x.model_dump() for x in c.citations] + [{"evidence_id": evid, "quote": shown[:120], "support": "full"}],
        "confidence_reason": "Leaver's Exit Q&A answer (pending reviewer approval)",
        "confirmed_by": actor, "confirmed_at": now(), "review_status": "pending", "method": "human"})
    bump(hid, actor, "answer_gap", f"Gap {short(gid)} answered by leaver (new Exit Q&A evidence)", role,
         c.id, {"statement": c.statement}, {"statement": new_statement})
    return gap_out(db().one("gaps", {"id": gid}))


# ---------------- tasks: the acknowledgement loop (Improvement 2) ----------------
def task_out(r: dict) -> dict:
    return {k: r.get(k) for k in ("id", "kind", "section", "claim_id", "text", "raised_by", "raised_role",
                                  "assigned_to", "status", "answer", "answer_by", "answer_evidence_id",
                                  "resolution_note", "version_raised", "version_resolved", "created_at", "updated_at")}


def _new_task(hid: str, kind: str, section: Optional[str], text: str, role: str, claim_id: Optional[str] = None) -> dict:
    h = get_handover_row(hid)
    tid = f"{P(hid)}task_{uuid.uuid4().hex[:6]}"
    assigned = "both" if h.get("leaver_available", True) else "lead"
    row = {"id": tid, "handover_id": hid, "kind": kind, "section": section, "claim_id": claim_id, "text": text,
           "raised_by": ACTORS[role], "raised_role": role, "assigned_to": assigned, "version_raised": h["version"]}
    db().ins("tasks", [row])
    audit.append(db(), hid, ACTORS[role], "flag_unclear" if kind == "unclear_flag" else "ask_question",
                 f"{'Flagged unclear' if kind == 'unclear_flag' else 'Asked'}: {section or ''} — {text}", role=role,
                 target_type="task", target_id=tid)
    return db().one("tasks", {"id": tid})


class NewTask(BaseModel):
    kind: str = "successor_question"
    section: Optional[str] = None
    claim_id: Optional[str] = None
    text: str


@app.post("/handovers/{hid}/tasks")
def create_task(hid: str, body: NewTask, x_demo_role: Optional[str] = Header(None)):
    role = role_of(x_demo_role)
    need(role, "contributor")
    if body.kind not in ("unclear_flag", "successor_question"):
        raise HTTPException(400, "kind must be unclear_flag or successor_question")
    if len(body.text.strip()) < 5:
        raise HTTPException(400, "Say what is unclear (at least 5 characters).")
    return task_out(_new_task(hid, body.kind, body.section, body.text.strip(), role, body.claim_id))


@app.get("/handovers/{hid}/tasks")
def list_tasks(hid: str, status: Optional[str] = None, x_demo_role: Optional[str] = Header(None)):
    role = role_of(x_demo_role)
    need(role, "lead", "leaver", "contributor")
    rows = db().sel("tasks", {"handover_id": hid}, order="created_at.desc")
    if role == "leaver":
        rows = [r for r in rows if r["assigned_to"] in ("leaver", "both")]
    elif role == "contributor":
        rows = [r for r in rows if r["raised_by"] == ACTORS["contributor"]]
    return [task_out(r) for r in rows if not status or r["status"] == status]


@app.post("/tasks/{tid}/answer")
def answer_task(tid: str, body: Answer, x_demo_role: Optional[str] = Header(None)):
    role = role_of(x_demo_role)
    need(role, "leaver", "lead")
    t = db().one("tasks", {"id": tid})
    if not t:
        raise not_found("Task not found")
    if role == "leaver" and t["assigned_to"] == "lead":
        raise not_found("Task not found")
    if t["status"] in ("resolved", "wont_fix"):
        raise HTTPException(409, "This question is already closed.")
    text = body.answer.strip()
    if not text:
        raise HTTPException(400, "Answer cannot be empty.")
    evid = _add_exit_qa(t["handover_id"], ACTORS[role], text)
    db().upd("tasks", {"id": tid}, {"status": "answered", "answer": redact_text(text, scan(text)),
                                    "answer_by": ACTORS[role], "answer_evidence_id": evid, "updated_at": now()})
    audit.append(db(), t["handover_id"], ACTORS[role], "answer_task",
                 "Answered the successor's question (new Exit Q&A evidence)", role=role, target_type="task",
                 target_id=tid)
    return task_out(db().one("tasks", {"id": tid}))


class TaskResolve(BaseModel):
    action: str                      # attach | new_claim | resolve | wont_fix
    claim_id: Optional[str] = None
    statement: Optional[str] = None
    note: str = ""


@app.post("/tasks/{tid}/resolve")
def resolve_task(tid: str, body: TaskResolve, x_demo_role: Optional[str] = Header(None)):
    role = role_of(x_demo_role)
    need(role, "lead")
    actor = ACTORS[role]
    t = db().one("tasks", {"id": tid})
    if not t:
        raise not_found("Task not found")
    hid = t["handover_id"]
    if t["status"] in ("resolved", "wont_fix"):
        raise HTTPException(409, "This task is already closed.")
    h = get_handover_row(hid)
    patch = {"status": "resolved", "version_resolved": h["version"] + 1, "updated_at": now(),
             "resolution_note": body.note.strip() or None}
    summary = ""
    if body.action in ("attach", "new_claim"):
        if not t.get("answer_evidence_id"):
            raise HTTPException(400, "There is no answer to use yet.")
        ev = db().one("evidence_units", {"id": t["answer_evidence_id"]})
        quote = redact_text(ev["text"], [Redaction(**x) for x in (ev.get("redactions") or [])])[:160]
        cite = {"evidence_id": ev["id"], "quote": quote, "support": "full"}
        if body.action == "attach":
            c = claim_row(body.claim_id or "")
            if c["handover_id"] != hid:
                raise not_found("Claim not found")
            new_stmt = (body.statement or "").strip() or c["statement"]
            claim_patch = {"citations": (c.get("citations") or []) + [cite], "statement": new_stmt,
                           "review_status": "edited", "state": "confirmed", "confirmed_by": actor,
                           "confirmed_at": now(), "confidence_reason": "Confirmed with the leaver's answer to a successor question"}
            db().upd("claims", {"id": c["id"]}, claim_patch)
            patch["claim_id"] = c["id"]
            summary = f"Attached the leaver's answer to claim {short(c['id'])}"
        else:
            stmt = (body.statement or "").strip() or t["answer"]
            cid = f"{P(hid)}cl_task_{short(tid)}"
            new = Claim(id=cid, handover_id=hid, type="fact", statement=stmt, state="confirmed",
                        confidence_reason="From the leaver's answer to a successor question", workstream="general",
                        section=t.get("section") or "state", citations=[cite], review_status="approved",
                        confirmed_by=actor, confirmed_at=now(), method="human", label="contributor")
            db().ins("claims", [new.model_dump()], upsert=True)
            patch["claim_id"] = cid
            summary = f"New claim from the leaver's answer ({short(cid)})"
    elif body.action in ("resolve", "wont_fix"):
        if len(body.note.strip()) < 5:
            raise HTTPException(400, "Write a short reason.")
        patch["status"] = "resolved" if body.action == "resolve" else "wont_fix"
        summary = f"{'Resolved' if body.action == 'resolve' else 'Closed without change'}: {body.note.strip()}"
    else:
        raise HTTPException(400, "action must be attach, new_claim, resolve or wont_fix")
    db().upd("tasks", {"id": tid}, patch)
    bump(hid, actor, "resolve_task", f"Task {short(tid)}: {summary}", role, target_type="task", target_id=tid)
    return task_out(db().one("tasks", {"id": tid}))


@app.get("/handovers/{hid}/notifications")
def notifications(hid: str, x_demo_role: Optional[str] = Header(None)):
    role = role_of(x_demo_role)
    h = get_handover_row(hid)
    items = []
    tasks = db().sel("tasks", {"handover_id": hid})
    if role == "lead":
        cfs = db().sel("conflicts", {"handover_id": hid}, select="resolution")
        claims = db().sel("claims", {"handover_id": hid}, select="type,review_status")
        items = [("conflicts", "Open conflicts", sum(c["resolution"] == "open" for c in cfs), "conflicts"),
                 ("deferred", "Deferred conflicts", sum(c["resolution"] == "deferred" for c in cfs), "conflicts"),
                 ("answered_tasks", "Answers waiting for you", sum(t["status"] == "answered" for t in tasks), "tasks"),
                 ("open_tasks", "Questions the leaver has not answered", sum(t["status"] == "open" for t in tasks), "tasks"),
                 ("pending_claims", "Claims to review",
                  sum(c["review_status"] == "pending" and c["type"] != "gap" for c in claims), "ledger"),
                 ("privacy", "Privacy items to review",
                  len(db().sel("redaction_reviews", {"handover_id": hid, "decision": "pending"}, select="id")), "privacy")]
    elif role == "leaver":
        gaps = db().sel("gaps", {"handover_id": hid}, select="status")
        items = [("tasks", "Questions from your successor",
                  sum(t["status"] == "open" and t["assigned_to"] in ("leaver", "both") for t in tasks), "interview"),
                 ("gaps", "Gap Interview questions", sum(g["status"] == "open" for g in gaps), "interview")]
    elif role == "contributor":
        mine = [t for t in tasks if t["raised_by"] == ACTORS["contributor"]]
        acked = {a["section"] for a in db().sel("acknowledgements", {"handover_id": hid, "version": h["version"],
                                                                      "actor": ACTORS["contributor"]})
                 if a["status"] == "acknowledged"}
        items = [("answers", "Your questions that were answered",
                  sum(t["status"] in ("answered", "resolved") for t in mine), "start"),
                 ("to_ack", "Sections to acknowledge", (len(SECTIONS) - len(acked)) if h["version"] else 0, "start")]
    return {"version": h["version"], "status": h["status"],
            "items": [{"key": k, "label": l, "count": n, "tab": tab} for k, l, n, tab in items]}


# ---------------- readiness, versions, publish ----------------
def readiness_of(hid: str) -> dict:
    from .analysis import compute_readiness
    claims = [to_claim(r) for r in claims_of(hid) if r["review_status"] not in ("rejected", "superseded")]
    conflicts = [Conflict(**{k: v for k, v in r.items() if k in Conflict.model_fields})
                 for r in db().sel("conflicts", {"handover_id": hid})]
    gaps = [Gap(**gap_out(r)) for r in db().sel("gaps", {"handover_id": hid})]
    return compute_readiness(claims, conflicts, gaps).model_dump()


@app.get("/handovers/{hid}/readiness")
def readiness(hid: str, x_demo_role: Optional[str] = Header(None)):
    need(role_of(x_demo_role), "lead")
    return readiness_of(hid)


def _live_snapshot(hid: str, version: int) -> dict:
    gaps = [gap_out(r) for r in db().sel("gaps", {"handover_id": hid})]
    conflicts = [conflict_out(r) for r in db().sel("conflicts", {"handover_id": hid})]
    return snapshots.build(hid, version, claims_of(hid), conflicts, gaps, label_map(hid), readiness_of(hid))


def _version_row(hid: str, v: int) -> dict | None:
    return db().one("handover_versions", {"handover_id": hid, "version": v})


def _publish_blockers(hid: str) -> list[str]:
    reasons = []
    open_cf = [c for c in db().sel("conflicts", {"handover_id": hid}) if c["resolution"] == "open"]
    if open_cf:
        reasons.append(f"{len(open_cf)} conflict(s) open. Settle them or defer them to the successor.")
    pending = [c for c in db().sel("claims", {"handover_id": hid}, select="id,type,review_status")
               if c["review_status"] == "pending" and c["type"] != "gap"]
    if pending:
        reasons.append(f"{len(pending)} claim(s) have not been reviewed yet.")
    people = db().sel("redaction_reviews", {"handover_id": hid, "decision": "pending", "detector": "people_sensitive"},
                      select="id")
    if people:
        reasons.append(f"{len(people)} possible personal judgement(s) about people need a privacy decision.")
    return reasons


def _publish(hid: str, actor: str, role: str, note: str = "") -> dict:
    h = get_handover_row(hid)
    v = (h.get("version") or 0) + 1
    snap = _live_snapshot(hid, v)
    digest = snapshots.sha256(snap)
    prev = _version_row(hid, v - 1) if v > 1 else None
    summary = {"claims": len(snap["claims"]), "revision": h.get("revision"), "note": note}
    db().ins("handover_versions", [{"handover_id": hid, "version": v, "published_by": actor, "snapshot": snap,
                                    "sha256": digest, "summary": summary}])
    db().upd("handovers", {"id": hid}, {"status": "published", "version": v, "approved_by": actor,
                                        "published_at": now()})
    # Unchanged sections keep each reader's acknowledgement; changed sections must be read again.
    if prev:
        old_h = snapshots.section_hashes(prev["snapshot"]["claims"])
        new_h = snapshots.section_hashes(snap["claims"])
        same = {k for k in new_h if old_h.get(k) == new_h[k]}
        carry = [{"handover_id": hid, "section": a["section"], "status": "acknowledged", "actor": a["actor"],
                  "version": v, "carried_over": True, "note": None}
                 for a in db().sel("acknowledgements", {"handover_id": hid, "version": v - 1})
                 if a["status"] == "acknowledged" and a["section"] in same]
        if carry:
            db().ins("acknowledgements", carry, upsert=True)
    log(hid, actor, "publish", f"Published v{v} (SHA-256 {digest[:12]}…). {note}".strip(), role=role,
        target_type="version", target_id=str(v), meta={"sha256": digest, "version": v})
    return {"ok": True, "version": v, "sha256": digest}


@app.post("/handovers/{hid}/publish")
def publish(hid: str, x_demo_role: Optional[str] = Header(None)):
    role = role_of(x_demo_role)
    need(role, "lead")
    h = get_handover_row(hid)
    if h["status"] == "published":
        raise HTTPException(400, f"Nothing changed since v{h['version']} was published.")
    reasons = _publish_blockers(hid)
    if reasons:
        raise HTTPException(400, " ".join(reasons))
    return _publish(hid, ACTORS[role], role)


@app.get("/handovers/{hid}/versions")
def versions(hid: str, x_demo_role: Optional[str] = Header(None)):
    """Published versions for everyone (guests: latest only); the draft change log for the lead."""
    role = role_of(x_demo_role)
    h = get_handover_row(hid)
    pub = [{"version": r["version"], "published_at": r["published_at"], "published_by": r["published_by"],
            "sha256": r["sha256"], "summary": r.get("summary") or {}}
           for r in db().sel("handover_versions", {"handover_id": hid}, select="version,published_at,published_by,sha256,summary",
                             order="version.desc")]
    if role == "guest":
        pub = pub[:1]
    draft = None
    if role == "lead":
        rows = db().sel("review_actions", {"handover_id": hid}, order="at.desc")
        draft = {"revision": h.get("revision"), "status": h["status"],
                 "log": [{"revision": (r["after"] or {}).get("revision"), "at": r["at"], "actor": r["actor"],
                          "action": r["action"], "summary": (r["after"] or {}).get("summary") or r["action"],
                          "claim_id": r.get("claim_id")} for r in rows]}
    return {"published": pub, "draft": draft}


def _snapshot_for(hid: str, v: int, role: str) -> dict:
    if v == 0:
        if role != "lead":
            raise not_found("Draft not available")
        h = get_handover_row(hid)
        return _live_snapshot(hid, h["version"] + 1)
    row = _version_row(hid, v)
    if not row:
        raise not_found(f"Version {v} not found")
    return row["snapshot"]


@app.get("/handovers/{hid}/versions/{a}/diff/{b}")
def version_diff(hid: str, a: int, b: int, x_demo_role: Optional[str] = Header(None)):
    """What changed between two published versions (b = 0 means the current draft, lead only), filtered to what
    the caller may see in each version."""
    role = role_of(x_demo_role)
    labels = label_map(hid)
    sa, sb = _snapshot_for(hid, a, role), _snapshot_for(hid, b, role)
    va, ha = snapshots.visible(sa, role, labels)
    vb, hb = snapshots.visible(sb, role, labels)
    _with_project(va), _with_project(vb)
    d = snapshots.diff(va, vb, ha, hb)
    d["from"], d["to"] = a, b
    return d


# ---------------- successor view + acknowledgements ----------------
@app.get("/handovers/{hid}/view")
def view(hid: str, version: Optional[int] = None, draft: bool = False, as_: Optional[str] = Query(None, alias="as"),
         x_demo_role: Optional[str] = Header(None)):
    """The handover a role receives: the latest published snapshot (or ?version=N), filtered to that role.
    The lead may preview the draft (?draft=1) or view as another role (?as=contributor|leaver|guest)."""
    role = role_of(x_demo_role)
    eff = role
    if as_:
        need(role, "lead")
        eff = role_of(as_)
    if draft:
        need(role, "lead")
    h = get_handover_row(hid)
    v = version or h["version"]
    labels = label_map(hid)
    if draft or (v == 0 and role == "lead"):
        snap, v_out, is_draft = _live_snapshot(hid, h["version"] + 1), h["version"] + 1, True
    elif v == 0:
        out = handover_out(h)
        return {"handover": out, "version": 0, "draft": False, "not_published": True, "sha256": None,
                "sections": [{"key": k, "title": t, "claims": [], "ack": "none", "carried_over": False}
                             for k, t in SECTIONS], "hidden_count": 0, "last_ack_version": 0, "versions": []}
    else:
        row = _version_row(hid, v)
        if not row:
            raise not_found(f"Version {v} not found")
        snap, v_out, is_draft = row["snapshot"], v, False
    claims, hidden = snapshots.visible(snap, eff, labels)
    _with_project(claims)
    actor = ACTORS.get(eff, eff)
    acks = {a["section"]: a for a in db().sel("acknowledgements", {"handover_id": hid, "version": v_out, "actor": actor})}
    mine = db().sel("acknowledgements", {"handover_id": hid, "actor": actor}, select="version,status")
    # the last version this reader engaged with (read it, or flagged part of it as unclear)
    last_ack = max([a["version"] for a in mine if a["status"] in ("acknowledged", "unclear") and a["version"] < v_out] or [0])
    changed: set = set()
    if last_ack and not is_draft:
        old = _version_row(hid, last_ack)
        if old:
            ov, oh = snapshots.visible(old["snapshot"], eff, labels)
            _with_project(ov)
            changed = set(snapshots.diff(ov, claims, oh, hidden)["sections_changed"])
    sections = [{"key": k, "title": t, "claims": [c for c in claims if c.get("section") == k],
                 "ack": acks[k]["status"] if k in acks else "none",
                 "carried_over": bool(acks.get(k, {}).get("carried_over")), "changed": k in changed}
                for k, t in SECTIONS]
    pubs = [r["version"] for r in db().sel("handover_versions", {"handover_id": hid}, select="version", order="version.desc")]
    if eff != "lead" and not is_draft:
        log_view(hid, eff, "view_handover", "version", str(v_out), f"Opened the handover (v{v_out})")
    row = None if is_draft else _version_row(hid, v_out)
    return {"handover": handover_out(h), "version": v_out, "draft": is_draft, "not_published": False,
            "sha256": row["sha256"] if row else None, "published_at": row["published_at"] if row else None,
            "sections": sections, "hidden_count": 0 if eff == "lead" else hidden, "last_ack_version": last_ack,
            "versions": pubs, "viewing_as": eff}


def _with_project(claims: list[dict]) -> list[dict]:
    """Stored runs made before the 'Project in five lines' section existed: pick it at read time, the same way for
    every version so comparisons stay fair."""
    if not any(c.get("section") == "project" for c in claims):
        from .analysis import pick_project_claims
        picked = {c.id for c in pick_project_claims([to_claim(x) for x in claims])}
        for x in claims:
            if x["id"] in picked:
                x["section"] = "project"
    return claims


class Ack(BaseModel):
    section: str
    status: str
    note: Optional[str] = None


@app.post("/handovers/{hid}/ack")
def ack(hid: str, body: Ack, x_demo_role: Optional[str] = Header(None)):
    role = role_of(x_demo_role)
    need(role, "contributor")
    h = get_handover_row(hid)
    if not h["version"]:
        raise HTTPException(400, "Nothing has been published yet, so there is nothing to acknowledge.")
    if body.status not in ("none", "acknowledged", "unclear"):
        raise HTTPException(400, "Bad status")
    if body.section not in {k for k, _ in SECTIONS}:
        raise HTTPException(400, "Unknown section")
    actor = ACTORS[role]
    db().ins("acknowledgements", [{"handover_id": hid, "section": body.section, "status": body.status,
                                   "note": body.note, "actor": actor, "version": h["version"],
                                   "carried_over": False}], upsert=True)
    task = None
    if body.status == "unclear":
        text = (body.note or "").strip() or "This section is unclear (no details given)."
        task = task_out(_new_task(hid, "unclear_flag", body.section, text, role))
    else:
        audit.append(db(), hid, actor, "ack", f"Acknowledged: {body.section} (v{h['version']})", role=role,
                     target_type="section", target_id=body.section)
    return {"ok": True, "version": h["version"], "task": task}


# ---------------- audit log, exports ----------------
@app.get("/handovers/{hid}/audit")
def audit_log(hid: str, action: Optional[str] = None, actor: Optional[str] = None,
              x_demo_role: Optional[str] = Header(None)):
    need(role_of(x_demo_role), "lead")
    rows = db().sel("audit_log", {"handover_id": hid}, order="seq.desc")
    out = [{"seq": r["seq"], "at": (r.get("meta") or {}).get("ts") or r.get("at"), "actor": r["actor"],
            "role": r.get("role"), "action": r["action"], "summary": r["summary"], "target_type": r.get("target_type"),
            "target_id": r.get("target_id"),
            "claim_id": r.get("target_id") if r.get("target_type") == "claim" else None}
           for r in rows]
    return [r for r in out if (not action or r["action"] == action) and (not actor or r["actor"] == actor)]


@app.get("/handovers/{hid}/audit/verify")
def audit_verify(hid: str, x_demo_role: Optional[str] = Header(None)):
    need(role_of(x_demo_role), "lead")
    return audit.verify(db(), hid)


@app.get("/handovers/{hid}/audit.csv", response_class=PlainTextResponse)
def audit_csv(hid: str, x_demo_role: Optional[str] = Header(None)):
    rows = audit_log(hid, x_demo_role=x_demo_role)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["seq", "at", "actor", "role", "action", "summary", "target_type", "target_id"])
    for r in reversed(rows):
        w.writerow([r["seq"], r["at"], r["actor"], r["role"], r["action"], r["summary"], r["target_type"], r["target_id"]])
    return PlainTextResponse(buf.getvalue(), media_type="text/csv")


class ExportLog(BaseModel):
    format: str
    version: Optional[int] = None


@app.post("/handovers/{hid}/exports")
def log_export(hid: str, body: ExportLog, x_demo_role: Optional[str] = Header(None)):
    """Records an export in the audit log and returns the version hash to print on it."""
    role = role_of(x_demo_role)
    if role == "guest":
        raise HTTPException(403, "Guests cannot export.")
    h = get_handover_row(hid)
    v = body.version or h["version"]
    row = _version_row(hid, v) if v else None
    audit.append(db(), hid, ACTORS[role], "export", f"Exported v{v} as {body.format}", role=role,
                 target_type="version", target_id=str(v), meta={"format": body.format,
                                                                 "sha256": row["sha256"] if row else None})
    return {"version": v, "sha256": row["sha256"] if row else None, "exported_at": now()}


# ---------------- privacy review queue (Improvement 3) ----------------
DETECTOR_NAMES = {"api_key": "API key", "jwt": "Login token (JWT)", "private_key": "Private key",
                  "url_token": "Token inside a link", "password_assignment": "Password or secret",
                  "env_line": "Environment secret", "upi_id": "UPI ID", "email": "Email address",
                  "pan": "PAN number", "aadhaar": "Aadhaar number", "ifsc": "Bank IFSC code", "phone": "Phone number",
                  "people_sensitive": "Judgement about a person", "manual": "Masked by a reviewer", "": "Masked"}


def _preview(text: str, start: int, end: int, reds: list[Redaction]) -> str:
    """Masked context around a span. The raw value never leaves the API, even for the reviewer."""
    a, b = max(0, start - 40), min(len(text), end + 40)
    inside = [Redaction(start=r.start - a, end=r.end - a, kind=r.kind) for r in reds if r.start >= a and r.end <= b]
    return ("…" if a else "") + redact_text(text[a:b], inside) + ("…" if b < len(text) else "")


def build_privacy_queue(hid: str) -> int:
    """One queue row per masked span, plus suggestions for judgements about people in text a successor could
    read. Idempotent: existing rows (and their decisions) are kept."""
    from .protect import people_sensitive
    have = {r["id"] for r in db().sel("redaction_reviews", {"handover_id": hid}, select="id")}
    rows = []
    for u in db().sel("evidence_units", {"handover_id": hid}):
        reds = [Redaction(**x) for x in (u.get("redactions") or [])]
        for r in reds:
            rid = f"rr_{u['id']}_{r.start}"
            if rid not in have:
                rows.append({"id": rid, "handover_id": hid, "evidence_id": u["id"], "start_pos": r.start,
                             "end_pos": r.end, "detector": r.detector or r.kind, "kind": r.kind,
                             "preview": _preview(u["text"], r.start, r.end, reds),
                             "decision": "keep_masked" if r.kind == "secret" else "pending"})
        if u["label"] != "lead_only":
            for s, e in people_sensitive(u["text"]):
                rid = f"rr_{u['id']}_p{s}"
                if rid not in have:
                    rows.append({"id": rid, "handover_id": hid, "evidence_id": u["id"], "start_pos": s, "end_pos": e,
                                 "detector": "people_sensitive", "kind": "suggestion",
                                 "preview": _preview(u["text"], max(0, s - 60), min(len(u["text"]), e + 60), reds),
                                 "decision": "pending"})
    if rows:
        db().ins("redaction_reviews", rows)
    return len(rows)


@app.get("/handovers/{hid}/redactions")
def privacy_queue(hid: str, status: Optional[str] = None, x_demo_role: Optional[str] = Header(None)):
    need(role_of(x_demo_role), "lead")
    units = {u["id"]: u for u in units_all(hid)}
    srcs = sources_all(hid)
    out = []
    for r in db().sel("redaction_reviews", {"handover_id": hid}, order="id.asc"):
        if status and r["decision"] != status:
            continue
        u = units.get(r["evidence_id"], {})
        s = srcs.get(u.get("source_id"), {})
        out.append({**{k: r.get(k) for k in ("id", "evidence_id", "detector", "kind", "preview", "decision",
                                             "decided_by", "decided_at", "reason")},
                    "detector_name": DETECTOR_NAMES.get(r["detector"], r["detector"]),
                    "source_name": s.get("name"), "source_id": u.get("source_id"), "label": u.get("label"),
                    "author": u.get("author"), "ts": u.get("ts"), "locator": u.get("locator")})
    counts = {}
    for r in out:
        counts[r["decision"]] = counts.get(r["decision"], 0) + 1
    return {"items": out, "counts": counts}


class Decide(BaseModel):
    decision: str            # keep_masked | unmask | escalate_lead_only | dismiss (suggestions)
    reason: str = ""


@app.post("/redactions/{rid}/decide")
def decide_redaction(rid: str, body: Decide, x_demo_role: Optional[str] = Header(None)):
    role = role_of(x_demo_role)
    need(role, "lead")
    actor = ACTORS[role]
    r = db().one("redaction_reviews", {"id": rid})
    if not r:
        raise not_found("Item not found")
    hid, eid = r["handover_id"], r["evidence_id"]
    reason = body.reason.strip()
    d = body.decision
    if d not in ("keep_masked", "unmask", "escalate_lead_only", "dismiss"):
        raise HTTPException(400, "decision must be keep_masked, unmask, escalate_lead_only or dismiss")
    if d in ("unmask", "escalate_lead_only", "dismiss") and len(reason) < 5:
        raise HTTPException(400, "Write a short reason for this decision.")
    if d == "unmask":
        if r["kind"] == "secret":
            raise HTTPException(400, "Secrets cannot be unmasked. Mask it, or make the whole source lead-only.")
        if r["kind"] == "suggestion":
            raise HTTPException(400, "Nothing is masked here; use dismiss or escalate_lead_only.")
        u = db().one("evidence_units", {"id": eid})
        keep = [x for x in (u.get("redactions") or []) if not (x["start"] == r["start_pos"] and x["end"] == r["end_pos"])]
        db().upd("evidence_units", {"id": eid}, {"redactions": keep})
    if d == "escalate_lead_only":
        db().upd("evidence_units", {"id": eid}, {"label": "lead_only"})
        recompute_labels(hid)
    stored = {"dismiss": "keep_masked" if r["kind"] != "suggestion" else "unmask"}.get(d, d)
    db().upd("redaction_reviews", {"id": rid}, {"decision": stored, "decided_by": actor, "decided_at": now(),
                                               "reason": reason or None})
    cache_clear()
    words = {"keep_masked": "kept masked", "unmask": "unmasked (not sensitive)", "dismiss": "dismissed (not sensitive)",
             "escalate_lead_only": "made the passage lead-only"}[d]
    bump(hid, actor, "privacy_decision", f"Privacy: {DETECTOR_NAMES.get(r['detector'], r['detector'])} {words}"
         + (f". Reason: {reason}" if reason else ""), role, target_type="evidence", target_id=eid)
    return {k: v for k, v in db().one("redaction_reviews", {"id": rid}).items() if k != "handover_id"}


class ManualMask(BaseModel):
    start: int
    end: int
    reason: str


@app.post("/evidence/{eid}/redact")
def manual_redact(eid: str, body: ManualMask, x_demo_role: Optional[str] = Header(None)):
    role = role_of(x_demo_role)
    need(role, "lead")
    u = db().one("evidence_units", {"id": eid})
    if not u:
        raise not_found("Evidence not found")
    if not (0 <= body.start < body.end <= len(u["text"])) or len(body.reason.strip()) < 5:
        raise HTTPException(400, "Choose a valid range and give a reason.")
    reds = (u.get("redactions") or []) + [{"start": body.start, "end": body.end, "kind": "manual", "detector": "manual"}]
    db().upd("evidence_units", {"id": eid}, {"redactions": sorted(reds, key=lambda x: x["start"])})
    db().ins("redaction_reviews", [{"id": f"rr_{eid}_m{body.start}", "handover_id": u["handover_id"], "evidence_id": eid,
                                    "start_pos": body.start, "end_pos": body.end, "detector": "manual", "kind": "manual",
                                    "preview": _preview(u["text"], body.start, body.end,
                                                        [Redaction(**x) for x in reds]),
                                    "decision": "added_manual", "decided_by": ACTORS[role], "decided_at": now(),
                                    "reason": body.reason.strip()}], upsert=True)
    cache_clear()
    bump(u["handover_id"], ACTORS[role], "privacy_decision", f"Privacy: reviewer masked part of a passage. Reason: {body.reason.strip()}",
         role, target_type="evidence", target_id=eid)
    return {"ok": True}


# ---------------- demo seeding ----------------
@app.post("/demo/seed")
def seed_demo():
    """Create the CampusKart demo template (h_1) with sample sources. Idempotent."""
    if not db().one("handovers", {"id": TEMPLATE}):
        db().ins("handovers", [{"id": TEMPLATE, "leaver": "aditi", "successor": "karan",
                                "successor_role": "contributor", "target_date": "2026-11-30", "version": 0}])
        log(TEMPLATE, "Reviewer (lead)", "create", "Handover created.", role="lead", target_type="handover",
            target_id=TEMPLATE)
    ingest_sample(TEMPLATE)
    build_privacy_queue(TEMPLATE)
    return {"ok": True, "handover_id": TEMPLATE}
