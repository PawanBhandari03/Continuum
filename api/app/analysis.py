"""Conflicts, gaps, sections and the readiness score. Deterministic where possible."""
from __future__ import annotations
from itertools import combinations
from rapidfuzz import fuzz
from .models import Claim, Conflict, Gap, Readiness, EvidenceUnit
from .llm import Provider, contradicts_all

# Things a handover needs. A slot is "filled" by a verified/confirmed claim whose
# entity_key matches. Unfilled slots become Missing claims + interview questions.
REQUIRED_SLOTS = {
    "deploy": "Where is the project deployed (hosting target) and who controls it?",
    "payments": "How do payments work and who owns that integration?",
    "auth": "How does login/auth work and what known fragile parts exist?",
    "email": "Which email/SMTP account sends verification emails and who owns it?",
    "storage": "Where are uploaded images stored and who holds the credentials?",
}
MAX_PAIRS_PER_GROUP = 45
# Only claims that assert a current state can contradict each other; risks, to-dos and
# questions are not compared (keeps model calls few and avoids false conflicts).
CONFLICT_TYPES = {"fact", "decision", "dependency", "owner"}

_SECTION = {"decision": "decision_log", "risk": "risks", "dependency": "dependencies",
            "owner": "dependencies", "next_action": "first_week",
            "open_question": "unresolved", "fact": "state", "gap": "unresolved"}


# Deterministic mapping of free-form model topics onto the handover's required slots.
SLOT_KEYWORDS = {
    "deploy": ["render", "vercel", "netlify", "heroku", "deploy", "hosting", "hosted", "production server"],
    "payments": ["payment", "upi", "gateway", "kyc", "razorpay", "paise", "refund", "cash on delivery", "cod "],
    "auth": ["login", "log in", "auth", "session", "refresh token", "password", "sign-in", "signin"],
    "email": ["smtp", "email", "e-mail", "verification mail"],
    "storage": ["bucket", "image upload", "object storage", "s3", "storage", "uploaded image", "listing images"],
}


def normalize_entities(claims: list[Claim]) -> None:
    """Set entity_key/workstream to a required slot when the claim is clearly about one.
    Order matters: the statement decides first, then the model's own keys."""
    for c in claims:
        if c.type == "gap":
            continue
        for text in (c.statement.lower() + " ", f"{c.entity_key} {c.workstream}".lower() + " "):
            scores = {slot: sum(k in text for k in kws) for slot, kws in SLOT_KEYWORDS.items()}
            best = max(scores.values())
            hit = next((slot for slot, n in scores.items() if n == best), None) if best else None  # strongest match wins
            if hit:
                c.entity_key = c.workstream = hit
                break


_FILLING_TYPES = {"decision", "dependency", "owner", "fact"}


def fills_slot(c: Claim, slot: str) -> bool:
    """A claim only fills a required slot if it is a stable statement (not a risk,
    to-do or question) and its OWN text is about that topic; the model's tags alone
    are not trusted for readiness."""
    text = c.statement.lower() + " "
    return (c.entity_key == slot and c.type in _FILLING_TYPES
            and any(k in text for k in SLOT_KEYWORDS[slot]))


_RANK_STATE = {"confirmed": 3, "verified": 2, "conflicting": 1, "inferred": 0}


def dedup_claims(claims: list[Claim], threshold: int = 86) -> list[Claim]:
    """Merge near-identical claims of the same type (same fact extracted from different
    batches): keep the strongest state, union the citations."""
    kept: list[Claim] = []
    for c in claims:
        twin = next((k for k in kept if k.type == c.type and k.label == c.label and
                     fuzz.token_set_ratio(k.statement.lower(), c.statement.lower()) >= threshold), None)
        if twin is None:
            kept.append(c)
            continue
        have = {x.evidence_id for x in twin.citations}
        twin.citations += [x for x in c.citations if x.evidence_id not in have]
        if _RANK_STATE.get(c.state, 0) > _RANK_STATE.get(twin.state, 0):
            twin.state, twin.confidence_reason = c.state, c.confidence_reason
            twin.statement = c.statement
        twin.owner = twin.owner or c.owner
    return kept


def pick_project_claims(claims: list[Claim], n: int = 5) -> list[Claim]:
    """'Project in five lines': the best-supported Verified/Confirmed facts, decisions and
    dependencies, at most one per workstream. Nothing is written by the model; these are
    existing claims with their own citations."""
    pool = [c for c in claims if c.type in ("fact", "decision", "dependency") and c.state in ("verified", "confirmed")
            and c.review_status != "rejected"]
    pool.sort(key=lambda c: (c.state != "confirmed", -len(c.citations), c.id))
    picked, seen = [], set()
    for c in pool:
        if c.workstream in seen:
            continue
        seen.add(c.workstream)
        picked.append(c)
        if len(picked) == n:
            break
    return picked


def assign_sections(claims: list[Claim]) -> None:
    for c in claims:
        c.section = _SECTION.get(c.type, "state")
    for c in pick_project_claims(claims):
        c.section = "project"


def detect_conflicts(claims: list[Claim], provider: Provider) -> list[Conflict]:
    """Group by entity_key; ask the model about small candidate pairs only.
    Both sides are kept; nothing is auto-resolved and newest is NOT preferred."""
    groups: dict[str, list[Claim]] = {}
    for c in claims:
        if c.type in CONFLICT_TYPES and c.entity_key:
            kws = SLOT_KEYWORDS.get(c.entity_key)
            if kws and not any(k in c.statement.lower() + ' ' for k in kws):
                continue  # tagged with a topic, but its own text is not about it
            groups.setdefault(c.entity_key, []).append(c)
    candidates: list[tuple[str, Claim, Claim]] = []
    for key, grp in groups.items():
        n = 0
        for a, b in combinations(grp, 2):
            if a.statement == b.statement or n >= MAX_PAIRS_PER_GROUP:
                continue
            n += 1
            candidates.append((key, a, b))
    verdicts = contradicts_all(provider, [(a, b) for _, a, b in candidates])
    conflicts: list[Conflict] = []
    for (key, a, b), contradict in zip(candidates, verdicts):
        if not contradict:
            continue
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
    covered = {slot for slot in REQUIRED_SLOTS for c in claims
               if c.state in ("verified", "confirmed", "conflicting")
               and (fills_slot(c, slot) or (c.state == "conflicting" and c.entity_key == slot))}
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
    filled = len({slot for slot in REQUIRED_SLOTS for c in claims
                  if c.state in ("verified", "confirmed") and fills_slot(c, slot)})
    oc = sum(1 for c in conflicts if c.resolution == "open")
    og = sum(1 for g in gaps if g.status == "open")
    score = max(0, min(100, round(filled / total * 100 - 5 * oc - 3 * og)))
    return Readiness(
        score=score, slots_filled=filled, slots_total=total, open_conflicts=oc, open_gaps=og,
        formula="slots_filled(verified+confirmed)/slots_total*100 - 5*open_conflicts - 3*open_gaps")
