"""Secret / PII scan. Produces redaction spans; never mutates stored text."""
import re
from .models import EvidenceUnit, Redaction

_SECRET = re.compile(
    r"(sk_(?:test|live)_[A-Za-z0-9_]{8,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}"
    r"|xox[bap]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_\-]{30,}"
    r"|(?i:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*\S{6,})")
_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_PHONE = re.compile(r"(?<!\w)(?:\+?\d{1,3}[\s-]?)?(?:\d[\s-]?){9,12}\d(?!\w)")


def scan(text: str) -> list[Redaction]:
    spans: list[Redaction] = []
    for rx, kind in ((_SECRET, "secret"), (_EMAIL, "pii"), (_PHONE, "pii")):
        for m in rx.finditer(text):
            spans.append(Redaction(start=m.start(), end=m.end(), kind=kind))
    spans.sort(key=lambda r: r.start)
    merged: list[Redaction] = []
    for s in spans:  # drop overlaps
        if merged and s.start < merged[-1].end:
            continue
        merged.append(s)
    return merged


def protect(unit: EvidenceUnit) -> EvidenceUnit:
    unit.redactions = scan(unit.text)
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
