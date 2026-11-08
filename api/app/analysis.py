"""Conflicts, gaps, sections and the readiness score. Deterministic where possible."""
from __future__ import annotations
from itertools import combinations
from .models import Claim, Conflict, Gap, Readiness, EvidenceUnit
from .llm import Provider

# Things a handover needs. A slot is "filled" by a verified/confirmed claim whose
# entity_key matches. Unfilled slots become Missing claims + interview questions.
REQUIRED_SLOTS = {
    "deploy": "Where is the project deployed (hosting target) and who controls it?",
    "payments": "How do payments work and who owns that integration?",
    "auth": "How does login/auth work and what known fragile parts exist?",
    "email": "Which email/SMTP account sends verification emails and who owns it?",
    "storage": "Where are uploaded images stored and who holds the credentials?",
}
MAX_PAIRS_PER_GROUP = 6

_SECTION = {"decision": "decision_log", "risk": "risks", "dependency": "dependencies",
            "owner": "dependencies", "next_action": "first_week",
            "open_question": "unresolved", "fact": "state", "gap": "unresolved"}


def assign_sections(claims: list[Claim]) -> None:
    for c in claims:
        c.section = _SECTION.get(c.type, "state")


def detect_conflicts(claims: list[Claim], provider: Provider) -> list[Conflict]:
    """Group by entity_key; ask the model about small candidate pairs only.
    Both sides are kept; nothing is auto-resolved and newest is NOT preferred."""
    groups: dict[str, list[Claim]] = {}
    for c in claims:
        if c.type != "gap" and c.entity_key:
            groups.setdefault(c.entity_key, []).append(c)
    conflicts: list[Conflict] = []
    for key, grp in groups.items():
        pairs = 0
        for a, b in combinations(grp, 2):
            if a.statement == b.statement or pairs >= MAX_PAIRS_PER_GROUP:
                continue
            pairs += 1
            if provider.contradicts(a, b):
                cid = f"cf_{len(conflicts) + 1}"
                conflicts.append(Conflict(
                    id=cid, claim_ids=[a.id, b.id],
                    summary=f"Sources disagree about {key}: \"{a.statement}\" vs \"{b.statement}\""))
                for c in (a, b):
                    c.state, c.conflict_id = "conflicting", cid
                    c.confidence_reason = "Conflicts with another claim; not auto-resolved"
                    c.section = "unresolved"
    return conflicts


def detect_gaps(claims: list[Claim], units: list[EvidenceUnit]) -> tuple[list[Claim], list[Gap]]:
    """Return new Missing claims and interview questions for unfilled slots, plus
    questions for dependency/owner claims that name no owner."""
    new_claims: list[Claim] = []
    gaps: list[Gap] = []
    # A slot with conflicting claims is not "missing" (evidence exists, it disagrees);
    # it is surfaced through the conflict, and still does not count as filled for readiness.
    covered = {c.entity_key for c in claims if c.state in ("verified", "confirmed", "conflicting")}
    for slot, question in REQUIRED_SLOTS.items():
        if slot in covered:
            continue
        # evidence that mentions the slot but yielded no verified claim -> shown to the leaver
        found = [u.id for u in units if slot in u.text.lower()][:5]
        cid = f"cl_gap_{slot}"
        new_claims.append(Claim(
            id=cid, type="gap", state="missing", entity_key=slot, workstream=slot,
            statement=f"No verified information about: {slot}.",
            confidence_reason="Required for a handover; no supporting evidence found",
            section="unresolved", label="contributor"))
        gaps.append(Gap(id=f"gp_{slot}", claim_id=cid, question=question, evidence_found=found))
    for c in claims:
        if c.type in ("dependency", "owner") and not c.owner and c.state != "conflicting":
            gaps.append(Gap(id=f"gp_owner_{c.id}", claim_id=c.id,
                            question=f"Who owns: {c.statement}?",
                            evidence_found=[x.evidence_id for x in c.citations]))
    return new_claims, gaps


def compute_readiness(claims: list[Claim], conflicts: list[Conflict], gaps: list[Gap]) -> Readiness:
    total = len(REQUIRED_SLOTS)
    filled = len({c.entity_key for c in claims
                  if c.state in ("verified", "confirmed") and c.entity_key in REQUIRED_SLOTS})
    oc = sum(1 for c in conflicts if c.resolution == "open")
    og = sum(1 for g in gaps if g.status == "open")
    score = max(0, min(100, round(filled / total * 100 - 5 * oc - 3 * og)))
    return Readiness(
        score=score, slots_filled=filled, slots_total=total, open_conflicts=oc, open_gaps=og,
        formula="slots_filled(verified+confirmed)/slots_total*100 - 5*open_conflicts - 3*open_gaps")
