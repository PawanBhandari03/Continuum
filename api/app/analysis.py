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
        def same(k: Claim) -> bool:
            if k.method == "rules" or c.method == "rules":  # rule statements are raw sentences: near-identical only
                return fuzz.ratio(k.statement.lower(), c.statement.lower()) >= 92
            return fuzz.token_set_ratio(k.statement.lower(), c.statement.lower()) >= threshold
        twin = next((k for k in kept if k.type == c.type and k.label == c.label and same(k)), None)
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
    # core topics (deploy, payments, auth, email, storage) first: they say what the project is made of,
    # unlike repeated chat chatter that happens to have many citations
    pool.sort(key=lambda c: (c.entity_key not in REQUIRED_SLOTS or not fills_slot(c, c.entity_key),
                             c.state != "confirmed", -len(c.citations), c.id))
    core = [c for c in pool if c.entity_key in REQUIRED_SLOTS and fills_slot(c, c.entity_key)]
    if len({c.workstream for c in core}) >= 3:
        pool = core  # enough core-topic claims: do not pad with chat trivia
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


def _is_document(eid: str, units: dict) -> bool:
    u = units.get(eid)
    loc = (u.locator if u else "") or ""
    return "readme" in eid.lower() or loc.startswith("notes://") or loc.lower().endswith("readme.md")


def _newest(c: Claim, units: dict) -> str:
    return max((units[x.evidence_id].timestamp for x in c.citations if x.evidence_id in units), default=c.date or "")


def detect_conflicts(claims: list[Claim], provider: Provider, units: dict | None = None) -> list[Conflict]:
    """Group current-state claims by topic. Named values decide most pairs without AI (rules.rule_contradicts);
    the model is asked only about pairs the rules cannot judge. Pairs that disagree are clustered, so one
    disagreement = one conflict with all its sides. Nothing is auto-resolved and newest is NOT preferred."""
    from .rules import rule_contradicts
    units = units or {}
    groups: dict[str, list[Claim]] = {}
    for c in claims:
        if c.type in CONFLICT_TYPES and c.entity_key:
            kws = SLOT_KEYWORDS.get(c.entity_key)
            if kws and not any(k in c.statement.lower() + ' ' for k in kws):
                continue  # tagged with a topic, but its own text is not about it
            groups.setdefault(c.entity_key, []).append(c)
    edges: list[tuple[str, Claim, Claim, str]] = []
    ask: list[tuple[str, Claim, Claim]] = []
    for key, grp in groups.items():
        n = 0
        for a, b in combinations(grp, 2):
            if a.statement == b.statement or n >= MAX_PAIRS_PER_GROUP:
                continue
            n += 1
            verdict = rule_contradicts(a, b)
            if verdict is True:
                edges.append((key, a, b, "rules"))
            elif verdict is None:
                ask.append((key, a, b))
    for (key, a, b), contradict in zip(ask, contradicts_all(provider, [(a, b) for _, a, b in ask])):
        if contradict:
            edges.append((key, a, b, "model"))
    parent: dict[str, str] = {}

    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    by_id = {c.id: c for c in claims}
    for key, a, b, src in edges:  # union-find: connected disagreements become one conflict
        parent[find(a.id)] = find(b.id)
    comps: dict[str, list[str]] = {}
    how: dict[str, set] = {}
    for key, a, b, src in edges:
        for x in (a.id, b.id):
            members = comps.setdefault(find(x), [])
            if x not in members:
                members.append(x)
        how.setdefault(find(a.id), set()).add(src)
    conflicts: list[Conflict] = []
    rank = {"public": 0, "contributor": 1, "lead_only": 2}
    for root, ids in comps.items():
        sides = [by_id[i] for i in ids]
        key = sides[0].entity_key
        cid = f"cf_{len(conflicts) + 1}"
        docs = [c for c in sides if c.citations and all(_is_document(x.evidence_id, units) for x in c.citations)]
        acts = [c for c in sides if c not in docs]
        stale = bool(docs and acts and max(_newest(c, units) for c in acts) > max(_newest(c, units) for c in docs))
        owners = {c.owner for c in sides if c.owner}
        kind = ("staleness" if stale else
                "ownership" if all(c.type == "owner" for c in sides) and len(owners) > 1 else "value")
        if stale:
            d = docs[0]
            when = sorted({_newest(c, units)[:10] for c in acts})
            summary = (f'The documentation ({_newest(d, units)[:10] or "undated"}) says "{d.statement}", but newer '
                       f'activity ({", ".join(when)}) says "' + '" / "'.join(c.statement for c in acts) + '".')
        else:
            summary = f"Sources disagree about {key}: " + " vs ".join(f'"{c.statement}"' for c in sides)
        conflicts.append(Conflict(id=cid, claim_ids=ids, summary=summary, entity_key=key, kind=kind,
                                  severity="blocking" if key in REQUIRED_SLOTS else "warning",
                                  detected_by="+".join(sorted(how.get(root, {"model"}))),
                                  label=max((c.label for c in sides), key=lambda l: rank[l])))
        for c in sides:
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
    dc = sum(1 for c in conflicts if c.resolution == "deferred")
    og = sum(1 for g in gaps if g.status == "open")
    score = max(0, min(100, round(filled / total * 100 - 5 * oc - 2 * dc - 3 * og)))
    return Readiness(
        score=score, slots_filled=filled, slots_total=total, open_conflicts=oc, open_gaps=og, deferred_conflicts=dc,
        formula="slots_filled(verified+confirmed)/slots_total*100 - 5*open_conflicts - 2*deferred_conflicts - 3*open_gaps")
