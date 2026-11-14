"""Secret / personal-data scan and prompt-injection flags. Produces redaction spans; never mutates stored text.
Every span carries the detector that found it, so the reviewer's privacy queue can say why it was masked.
India-aware: PAN, Aadhaar (Verhoeff checksum), UPI IDs and IFSC codes, besides keys, tokens, emails and phones."""
import re
from .models import EvidenceUnit, Redaction

# (detector, kind, pattern). Order matters: earlier detectors win overlapping text (UPI before generic email).
_RULES: list[tuple[str, str, re.Pattern]] = [
    ("private_key", "secret", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)")),
    ("api_key", "secret", re.compile(r"sk_(?:test|live)_[A-Za-z0-9_]{8,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}"
                                     r"|github_pat_[A-Za-z0-9_]{20,}|xox[bap]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_\-]{30,}")),
    ("jwt", "secret", re.compile(r"eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}")),
    ("url_token", "secret", re.compile(r"https?://\S*?[?&](?:token|key|sig|signature|access_token|api_key)=[^\s&]{6,}\S*", re.I)),
    ("password_assignment", "secret", re.compile(r"(?i:password|passwd|pwd|secret|api[_-]?key|token)\s*[:=]\s*\S{6,}")),
    ("env_line", "secret", re.compile(r"(?m)^[A-Z][A-Z0-9_]{2,}(?:KEY|SECRET|TOKEN|PASSWORD|PASS)\s*=\s*\S{6,}")),
    ("upi_id", "pii", re.compile(r"\b[a-zA-Z0-9.\-_]{2,64}@(?:okaxis|oksbi|okhdfcbank|okicici|ybl|ibl|axl|paytm|upi|apl|"
                                 r"yapl|ptyes|ptsbi|ptaxis|pthdfc|freecharge|airtel|jio|kotak|icici|hdfcbank|sbi|axisbank)\b", re.I)),
    ("email", "pii", re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")),
    ("pan", "pii", re.compile(r"\b[A-Z]{3}[ABCFGHLJPT][A-Z][0-9]{4}[A-Z]\b")),
    ("aadhaar", "pii", re.compile(r"(?<!\d)[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?!\d)")),
    ("ifsc", "pii", re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b")),
    ("phone", "pii", re.compile(r"(?<![\w+])(?:\+91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?!\w)|(?<!\w)\+\d{1,3}[\s-]?(?:\d[\s-]?){8,12}\d(?!\w)")),
]

# Verhoeff checksum (used by Aadhaar): a 12-digit number that fails it is not an Aadhaar number.
_D = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
      [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
      [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
      [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]]
_P = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
      [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
      [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]]


def verhoeff_ok(number: str) -> bool:
    c = 0
    for i, ch in enumerate(reversed(number)):
        c = _D[c][_P[i % 8][int(ch)]]
    return c == 0


# Judgements about people (performance, health, discipline) are not secrets, but should not reach a successor by
# default. These become privacy-queue suggestions for the reviewer, never automatic masks.
PEOPLE_SENSITIVE = re.compile(
    r"\b(misses deadlines|underperform\w*|performance (issue|review|problem)|warning letter|disciplinary|"
    r"medical (leave|condition|issue)|mental health|needs (closer )?supervision|not reliable|unreliable|"
    r"attitude problem|lazy|was fired|termination)\b", re.I)

INJECTION = re.compile(
    r"(ignore (all |any )?(previous|prior|above) (instructions|rules)|disregard (the |all )?(instructions|rules)|"
    r"you are now|system prompt|act as (an?|the) |mark (this|it) as verified|output only|new instructions:)", re.I)


def scan(text: str) -> list[Redaction]:
    spans: list[Redaction] = []
    for detector, kind, rx in _RULES:
        for m in rx.finditer(text):
            if detector == "aadhaar" and not verhoeff_ok(re.sub(r"\D", "", m.group(0))):
                continue
            spans.append(Redaction(start=m.start(), end=m.end(), kind=kind, detector=detector))
    order = {d: i for i, (d, _, _) in enumerate(_RULES)}
    spans.sort(key=lambda r: (r.start, order[r.detector]))
    merged: list[Redaction] = []
    for s in spans:  # drop overlaps (first-listed detector wins at the same start)
        if merged and s.start < merged[-1].end:
            continue
        merged.append(s)
    return merged


def people_sensitive(text: str) -> list[tuple[int, int]]:
    return [(m.start(), m.end()) for m in PEOPLE_SENSITIVE.finditer(text)]


def flags_for(text: str) -> list[str]:
    return ["possible_injection"] if INJECTION.search(text or "") else []


def protect(unit: EvidenceUnit) -> EvidenceUnit:
    unit.redactions = scan(unit.text)
    unit.flags = sorted(set(unit.flags or []) | set(flags_for(unit.text)))
    return unit


def redact_text(text: str, redactions: list[Redaction]) -> str:
    """Text safe to send to a model or show to non-leads."""
    out, pos = [], 0
    for r in sorted(redactions, key=lambda r: r.start):
        out.append(text[pos:r.start])
        out.append(f"[REDACTED {r.kind.upper()}]")
        pos = r.end
    out.append(text[pos:])
    return "".join(out)
