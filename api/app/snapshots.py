"""Frozen published versions (Improvement 2 foundation). Publishing stores one snapshot of the handover with a
SHA-256 over its canonical JSON; successors read snapshots, never live draft claims. Role filtering happens at
read time, using the strictest of the label stored in the snapshot and the evidence's current label, so a
privacy decision taken after publishing (e.g. escalate to lead-only) applies immediately."""
from __future__ import annotations
import hashlib
import json

from .models import Claim, EvidenceUnit, LABEL_RANK
from .visibility import claim_visible

SECTIONS = [("project", "Project in five lines"), ("state", "Current state by workstream"),
            ("decision_log", "Decision log"), ("first_week", "Your first week"),
            ("risks", "Risks and landmines"), ("dependencies", "Dependencies and people"),
            ("unresolved", "Still unresolved")]
HIDDEN_REVIEW = ("rejected", "superseded")


def canonical(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256(obj) -> str:
    return hashlib.sha256(canonical(obj).encode()).hexdigest()


def build(hid: str, version: int, claims: list[dict], conflicts: list[dict], gaps: list[dict],
          unit_labels: dict[str, str], readiness: dict) -> dict:
    keep = [c for c in claims if c.get("review_status") not in HIDDEN_REVIEW]
    cited = {ci["evidence_id"] for c in keep for ci in (c.get("citations") or [])}
    return {
        "handover_id": hid, "version": version,
        "claims": sorted(keep, key=lambda c: c["id"]),
        "conflicts": sorted(conflicts, key=lambda c: c["id"]),
        "gaps": sorted(gaps, key=lambda g: g["id"]),
        "labels": {k: unit_labels[k] for k in sorted(cited) if k in unit_labels},
        "readiness": readiness,
    }


def _strictest(a: str | None, b: str | None) -> str:
    vals = [x for x in (a, b) if x]
    return max(vals, key=lambda l: LABEL_RANK[l]) if vals else "contributor"


def visible(snapshot: dict, role: str, current_labels: dict[str, str]) -> tuple[list[dict], int]:
    """Claims of the snapshot this role may see, and how many were hidden."""
    units = {eid: EvidenceUnit(id=eid, source_id="", author="", timestamp="", text="", locator="",
                               label=_strictest(lbl, current_labels.get(eid)))
             for eid, lbl in snapshot["labels"].items()}
    out, hidden = [], 0
    for c in snapshot["claims"]:
        if role == "lead":
            ok = c.get("review_status") != "redacted"
        else:
            ok = claim_visible(role, Claim(**c), units)
        if ok:
            out.append(c)
        else:
            hidden += 1
    return out, hidden


def section_hashes(claims: list[dict]) -> dict[str, str]:
    """Content fingerprint per section: used to carry acknowledgements over to a new version when a section
    did not change."""
    out = {}
    for key, _ in SECTIONS:
        inside = sorted((c["id"], c["statement"], c["state"]) for c in claims if c.get("section") == key)
        out[key] = hashlib.sha256(canonical(inside).encode()).hexdigest()
    return out


FIELDS = ("statement", "state", "section", "owner", "type")


def diff(a: list[dict], b: list[dict], hidden_a: int = 0, hidden_b: int = 0) -> dict:
    """Claim-level diff between two role-filtered claim lists (old a -> new b), grouped by section."""
    A, B = {c["id"]: c for c in a}, {c["id"]: c for c in b}
    added = [B[i] for i in sorted(B.keys() - A.keys())]
    removed = [A[i] for i in sorted(A.keys() - B.keys())]
    changed = []
    for i in sorted(A.keys() & B.keys()):
        fields = {f: {"before": A[i].get(f), "after": B[i].get(f)} for f in FIELDS if A[i].get(f) != B[i].get(f)}
        new_ev = {x["evidence_id"] for x in B[i].get("citations") or []} - \
                 {x["evidence_id"] for x in A[i].get("citations") or []}
        if fields or new_ev:
            changed.append({"claim_id": i, "section": B[i].get("section"), "fields": fields,
                            "before": A[i].get("statement"), "after": B[i].get("statement"),
                            "new_evidence": len(new_ev)})
    moved = {f["fields"]["section"]["before"] for f in changed if "section" in f["fields"]}
    sections = sorted(({c.get("section") for c in added + removed} | {c["section"] for c in changed} | moved) - {None})
    return {"added": added, "removed": removed, "changed": changed, "sections_changed": sections,
            "no_longer_visible": max(0, hidden_b - hidden_a)}
