"""Model provider interface. The pipeline only depends on this protocol, so the
real provider (Gemini or Claude) is a one-setting swap (LLM_PROVIDER env var)."""
from __future__ import annotations
from typing import Protocol
from .models import RawClaim, RawCitation, EvidenceUnit, Claim
from .protect import redact_text


class Provider(Protocol):
    def extract(self, units: list[EvidenceUnit]) -> list[RawClaim]: ...
    def support(self, statement: str, quotes: list[str]) -> str: ...  # supports|partially|does_not
    def contradicts(self, a: Claim, b: Claim) -> bool: ...


def safe_text(u: EvidenceUnit) -> str:
    """What the model is allowed to see: redacted text only."""
    return redact_text(u.text, u.redactions)


class FakeProvider:
    """Deterministic keyword-driven stand-in used for tests and offline dev.
    `rules` maps a lowercase trigger phrase to a claim template."""

    def __init__(self, rules: list[dict] | None = None, contradictions: set[frozenset] | None = None):
        self.rules = rules or []
        self.contradictions = contradictions or set()
        self.calls = {"extract": 0, "support": 0, "contradicts": 0}

    def extract(self, units):
        self.calls["extract"] += 1
        out = []
        for u in units:
            text = safe_text(u).lower()
            for r in self.rules:
                if r["trigger"] in text:
                    out.append(RawClaim(
                        type=r.get("type", "fact"), statement=r["statement"],
                        workstream=r.get("workstream", "general"),
                        entity_key=r.get("entity_key", r.get("workstream", "general")),
                        owner=r.get("owner"), inferred=r.get("inferred", False),
                        citations=[RawCitation(evidence_id=u.id, quote=r.get("quote", r["trigger"]))]))
        return out

    def support(self, statement, quotes):
        self.calls["support"] += 1
        return "supports" if quotes else "does_not"

    def contradicts(self, a, b):
        self.calls["contradicts"] += 1
        return frozenset({a.id, b.id}) in self.contradictions
