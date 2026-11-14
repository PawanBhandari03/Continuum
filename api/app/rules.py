"""Rules mode (spec 02 P0.1): a deterministic extractor that needs no AI, used when the model is unavailable
(quota, outage, no key) or on purpose (LLM_MODE=rules). Every rule claim's statement is the source sentence itself
and its quote is that exact span, so the quote check is honest; it is only 'Verified' because the source states it
word for word. Also: a deterministic contradiction check by comparing named values per topic."""
from __future__ import annotations
import re

from rapidfuzz import fuzz

from .models import Claim, EvidenceUnit, RawCitation, RawClaim
from .llm import safe_text

DECISION = re.compile(
    r"\b(we decided|decided to|decision:|we('ll| will) go with|going with|final(ised|ized)?\b|agreed (to|on)|"
    r"switch(ed|ing)? (to|from)|mov(e|ed|ing) (payments |it )?(to|from)|replac(e|ed|ing)|migrat(e|ed|ing) to|"
    r"we chose|chose to|final hai|final kar|decide kiya|tay hua)", re.I)
RISK = re.compile(r"\b(temporary|temp fix|hack|workaround|quick fix|fragile|flaky|keeps? (breaking|failing)|"
                  r"fails? again|broke again|phir se|todo|fixme)\b", re.I)
COMPLAINT = re.compile(r"\b(fail(s|ed|ing)?|broken|breaks?|error|crash(es|ed)?|not working)\b", re.I)
OPEN_Q = re.compile(r"(no decision yet|still undecided|not decided|\btbd\b|should we\b[^?]*\?|decide later)", re.I)
OWNER = re.compile(r"\b(?:only )?([A-Z][a-z]{2,})\b (?:owns|has the (?:credentials|keys|password|access|login)|"
                   r"holds the|is the only one|maintains|handles)\b")
ASK = re.compile(r"\bask ([A-Z][a-z]{2,})\b")
DEPLOY = re.compile(r"\b(deployed (on|to)|hosted on|runs on|deploy(s|ed|ing)? (the \w+ )?(app )?(to|on))\b", re.I)
CONFIG = re.compile(r"\b(vercel\.json|render\.yaml|netlify\.toml|procfile|fly\.toml)\b", re.I)
MARKER = re.compile(r"^\s*(DECISION|RISK|OWNER|TODO|NEXT|BLOCKER|QUESTION|DEPENDENCY)\s*:\s*(.{8,})$", re.I | re.M)
PR = re.compile(r"^(PR|Issue) #(\d+) \((open|closed|merged)\): (.+)", re.I)
COMMIT = re.compile(r"^Commit [0-9a-f]{7}: (.+)", re.I)
CHANGE = re.compile(r"\b(add(ed)?|configure[ds]?|switch(ed)?|mov(e|ed)|migrat(e|ed)|deploy(s|ed)?|set up|use[sd]?)\b", re.I)
SELF_OWNER = re.compile(r"\b(credential|password|key|access|login)s?\b[^.]{0,40}\b(sirf mere paas|mere paas|only (with )?me|only i have|i have (it|them))", re.I)
STORED = re.compile(r"\b(key|password|credential|token)s?\b[^.]{0,30}\b(is|are) (kept |stored )?(in|on) (the )?(shared|google|team)", re.I)

MARK_TYPE = {"decision": "decision", "risk": "risk", "owner": "owner", "todo": "next_action", "next": "next_action",
             "blocker": "risk", "question": "open_question", "dependency": "dependency"}

# Named values per topic, used to decide whether two claims about the same topic disagree.
VALUES = {
    "deploy": ["render", "vercel", "netlify", "heroku", "railway", "fly.io", "aws", "gcp", "firebase hosting"],
    "payments": ["upi", "card gateway", "razorpay", "stripe", "paytm", "cash on delivery", "cod"],
    "email": ["college smtp", "gmail", "sendgrid", "ses", "mailgun", "resend"],
    "storage": ["s3", "cloudinary", "firebase storage", "supabase storage"],
    "auth": ["jwt", "session cookie", "firebase auth", "supabase auth", "oauth"],
    # a tuple groups aliases of one value, so "Postgres" and "PostgreSQL" are never reported as a disagreement
    "database": [("postgres", "postgresql"), ("mysql", "mariadb"), "mongodb", "sqlite", "firestore"],
    "ci": [("github actions", "gh actions"), "circleci", "jenkins", ("gitlab ci", "gitlab-ci"), "travis"],
}
PAST = re.compile(r"\b(was|were|earlier|used to|previously|replaced|moved from|switched from|old|no longer|"
                  r"preview|staging|test payment|tested on)\b", re.I)


STOP = set("""a an the is are was were be been to of in on at for and or but if it this that these those i we you
they he she me my our your his her its with from by as so do does did not no yes again now then just also still same
thing time times third second first please someone anyone look will can could would should has have had ki ka ke hai
hain ho bhi aur ye wo to se mein par kya nahi""".split())
NEGATION = re.compile(r"\b(nahi|nahin|not|don't|do not|doesn't|no one|nobody|pata nahi)\b", re.I)
PROBLEM_WORDS = {"fail", "fails", "failed", "failing", "broken", "breaks", "break", "error", "crash", "crashes",
                 "crashed", "flaky", "slow", "stuck", "loop", "timeout"}


def _content(s: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9_]+", s.lower()) if w not in STOP and len(w) > 2}


def _sentences(text: str) -> list[str]:
    """Split on line breaks and on . ! ? followed by a space, so file names like vercel.json stay whole."""
    out = []
    for line in text.splitlines():
        out += [p.strip() for p in re.split(r"(?<=[.!?])\s+", line) if len(p.strip()) >= 8]
    return out


def _claim(typ: str, sentence: str, unit: EvidenceUnit, owner: str | None = None, extra: list[RawCitation] = ()) -> RawClaim:
    s = sentence.strip()[:220]
    return RawClaim(type=typ, statement=s, workstream="general", entity_key="general", owner=owner,
                    date=unit.timestamp[:10], inferred=False, method="rules",
                    citations=[RawCitation(evidence_id=unit.id, quote=s), *extra])


def values_in(text: str, slot: str) -> set[str]:
    """Named values of a topic found in the text, as canonical names (aliases collapsed)."""
    t = f" {text.lower()} "
    out = set()
    for entry in VALUES.get(slot, []):
        names = (entry,) if isinstance(entry, str) else entry
        if any(re.search(rf"(?<![a-z]){re.escape(n)}(?![a-z])", t) for n in names):
            out.add(names[0])
    return out


class RuleProvider:
    """Implements the Provider protocol (llm.py) without any model."""
    name = "rules"

    def extract(self, units: list[EvidenceUnit]) -> list[RawClaim]:
        out: list[RawClaim] = []
        for u in units:
            if "possible_injection" in (u.flags or []):
                continue  # instruction-like text is kept as evidence but never turned into a claim by rules
            text = safe_text(u)
            first = text.splitlines()[0] if text else ""
            m = PR.match(first)
            if m:
                kind, num, state, title = m.groups()
                title_line = first.strip()
                if state.lower() == "open":
                    out.append(_claim("next_action", title_line, u))
                elif DECISION.search(text) and kind.upper() == "PR":
                    sent = next((s for s in _sentences(text) if DECISION.search(s)), title_line)
                    out.append(_claim("decision", sent, u))
                elif RISK.search(title_line):
                    out.append(_claim("risk", title_line, u))
                continue
            cm = COMMIT.match(first)
            if cm:
                msg = first.strip()
                if any(values_in(msg, slot) for slot in VALUES) and CHANGE.search(msg):
                    out.append(_claim("fact", msg, u))
                elif RISK.search(msg):
                    out.append(_claim("risk", msg, u))
                continue
            for mk in MARKER.finditer(text):
                out.append(_claim(MARK_TYPE[mk.group(1).lower()], mk.group(0).strip(), u))
            for s in _sentences(text):
                if MARKER.match(s):
                    continue
                if len(_content(s)) < 3 and not CONFIG.search(s):
                    continue  # too short to stand on its own ("no decision yet.")
                if OPEN_Q.search(s):
                    out.append(_claim("open_question", s, u))
                elif DECISION.search(s):
                    out.append(_claim("decision", s, u))
                elif DEPLOY.search(s) or CONFIG.search(s):
                    out.append(_claim("fact", s, u))
                elif SELF_OWNER.search(s) and NEGATION.search(s):
                    out.append(_claim("open_question", s, u))  # "I do not have the password": nobody owns it
                elif SELF_OWNER.search(s):
                    out.append(_claim("dependency", s, u, owner=u.author))
                elif STORED.search(s):
                    out.append(_claim("dependency", s, u))
                elif (om := OWNER.search(s)):
                    out.append(_claim("dependency" if re.search(r"credential|key|password|access|login", s, re.I) else "owner",
                                      s, u, owner=om.group(1)))
                elif (am := ASK.search(s)) and re.search(r"credential|key|access|account|password", s, re.I):
                    out.append(_claim("dependency", s, u, owner=am.group(1)))
                elif RISK.search(s):
                    out.append(_claim("risk", s, u))
        return out

    def extract_cross(self, units: list[EvidenceUnit]) -> list[RawClaim]:
        """Runs once over ALL readable units (not per batch): the same complaint on different days. Chat only:
        tracker titles (Issue #, PR #, commits) are already one claim each."""
        items = [(s, u) for u in units if "possible_injection" not in (u.flags or [])
                 and not PR.match(safe_text(u)) and not COMMIT.match(safe_text(u))
                 for s in _sentences(safe_text(u)) if (COMPLAINT.search(s) or RISK.search(s)) and len(_content(s)) >= 4]
        return self._recurring(items)

    @staticmethod
    def _recurring(items: list[tuple[str, EvidenceUnit]]) -> list[RawClaim]:
        """The same complaint on different days is a recurring problem (one risk citing every occurrence).
        Similar = most meaningful words shared AND the same complaint word; groups are connected components."""
        words = [_content(s) for s, _ in items]
        parent = list(range(len(items)))

        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                a, b = words[i], words[j]
                if items[i][1].timestamp[:10] == items[j][1].timestamp[:10]:
                    continue
                shared = a & b
                if len(shared) >= 3 and len(shared) / min(len(a), len(b)) >= 0.5 and shared & PROBLEM_WORDS:
                    parent[find(i)] = find(j)
        groups: dict[int, list[int]] = {}
        for i in range(len(items)):
            groups.setdefault(find(i), []).append(i)
        out = []
        for idx in groups.values():
            if len({items[i][1].timestamp[:10] for i in idx}) < 2:
                continue
            idx.sort(key=lambda i: items[i][1].timestamp)
            s, u = items[idx[0]]
            extra = [RawCitation(evidence_id=items[i][1].id, quote=items[i][0][:220]) for i in idx[1:]]
            c = _claim("risk", s, u, extra=extra)
            c.statement = f"Recurring problem ({len(idx)} times since {u.timestamp[:10]}): {s[:200]}"
            out.append(c)
        return out

    def support(self, statement: str, quotes: list[str]) -> str:
        st = statement.lower().strip()
        if st.startswith("recurring problem"):
            return "supports" if len(quotes) >= 2 else "partially"
        return "supports" if any(q.lower().strip() == st or st in q.lower() for q in quotes) else "partially"

    def support_many(self, items):
        return [self.support(s, qs) for s, qs in items]

    def contradicts(self, a: Claim, b: Claim) -> bool:
        return rule_contradicts(a, b) is True

    def contradicts_many(self, pairs):
        return [self.contradicts(a, b) for a, b in pairs]


def rule_contradicts(a: Claim, b: Claim) -> bool | None:
    """True/False when the named values decide it; None when neither side names a known value (let the model judge)."""
    slot = a.entity_key if a.entity_key == b.entity_key else None
    if not slot or slot not in VALUES:
        return None
    ta = a.statement + " " + " ".join(c.quote for c in a.citations)
    tb = b.statement + " " + " ".join(c.quote for c in b.citations)
    va, vb = values_in(ta, slot), values_in(tb, slot)
    if not va or not vb:
        return None
    if PAST.search(a.statement) or PAST.search(b.statement):
        return False  # history or a test setup is not a disagreement about the present
    return not (va & vb)


class FallbackProvider:
    """Use the model when it works; fall back to rules call by call. `used` records who answered."""

    def __init__(self, primary, fallback=None):
        self.primary = primary
        self.fallback = fallback or RuleProvider()
        self.used = {"model": 0, "rules": 0}
        self.errors: list[str] = []

    def _try(self, name, *args):
        if self.primary is not None:
            try:
                r = getattr(self.primary, name)(*args)
                self.used["model"] += 1
                return r
            except Exception as e:
                self.errors.append(f"{name}: {type(e).__name__}: {str(e)[:120]}")
        self.used["rules"] += 1
        return getattr(self.fallback, name)(*args)

    def extract(self, units):
        return self._try("extract", units)

    def extract_cross(self, units):
        return self.fallback.extract_cross(units)  # deterministic either way

    def support(self, statement, quotes):
        return self._try("support", statement, quotes)

    def support_many(self, items):
        if self.primary is not None and hasattr(self.primary, "support_many"):
            return self._try("support_many", items)
        return [self.support(s, q) for s, q in items]

    def contradicts(self, a, b):
        return self._try("contradicts", a, b)

    def contradicts_many(self, pairs):
        if self.primary is not None and hasattr(self.primary, "contradicts_many"):
            return self._try("contradicts_many", pairs)
        return [self.contradicts(a, b) for a, b in pairs]
