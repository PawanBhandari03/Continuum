"""Deterministic citation checks + evidence-state assignment."""
from rapidfuzz import fuzz
from .models import RawClaim, Claim, Citation, EvidenceUnit
from .protect import redact_text

QUOTE_THRESHOLD = 85


def quote_matches(quote: str, text: str) -> bool:
    q, t = quote.strip().lower(), text.lower()
    if len(q) < 8:
        return False
    return q in t or fuzz.partial_ratio(q, t) >= QUOTE_THRESHOLD


def check_citations(raw: RawClaim, units_by_id: dict[str, EvidenceUnit],
                    batch_ids: set[str]) -> tuple[list[Citation], list[str]]:
    """Return (surviving citations, problems). IDs must exist AND be in the batch,
    and the quote must fuzzy-match the (redacted) source text."""
    good, problems = [], []
    for c in raw.citations:
        u = units_by_id.get(c.evidence_id)
        if u is None or c.evidence_id not in batch_ids:
            problems.append(f"unknown or out-of-batch evidence id {c.evidence_id}")
            continue
        if quote_matches(c.quote, redact_text(u.text, u.redactions)):
            good.append(Citation(evidence_id=c.evidence_id, quote=c.quote.strip()))
        else:
            problems.append(f"quote not found in {c.evidence_id}")
    return good, problems


def build_claim(raw: RawClaim, claim_id: str, citations: list[Citation],
                support: str | None, problems: list[str]) -> Claim | None:
    """support: 'supports' | 'partially' | 'does_not' | None (not checked).
    Only 'supports' with surviving citations and no model-declared inference
    can be Verified."""
    if not citations and not raw.inferred:
        return None  # nothing to stand on: drop rather than invent
    if citations and not raw.inferred and support == "supports":
        state, reason = "verified", ("Rule match: the source states this word for word (no AI)" if raw.method == "rules"
                                     else "Quote matches source; support check: supports")
    elif citations and not raw.inferred and support == "partially":
        state, reason = "inferred", "Source only partially supports this; treated as inference"
        citations = [c.model_copy(update={"support": "partial"}) for c in citations]
    else:
        state = "inferred"
        reason = "AI inference — not stated in any source"
        if problems:
            reason += "; " + "; ".join(problems)
    stmt = raw.statement
    if state == "inferred" and "AI inference" not in stmt:
        stmt = f"{stmt} (AI inference — not stated in any source)"
    return Claim(id=claim_id, type=raw.type, statement=stmt, state=state,
                 confidence_reason=reason, workstream=raw.workstream,
                 entity_key=raw.entity_key or raw.workstream, owner=raw.owner,
                 date=raw.date, citations=citations, method=raw.method)
