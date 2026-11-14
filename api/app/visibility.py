"""Permission before generation: who may see which evidence and claim."""
from .models import (Claim, EvidenceUnit, LABEL_RANK, ROLE_MAX_RANK, Role, AccessLabel)


def can_read(role: Role, label: AccessLabel) -> bool:
    return LABEL_RANK[label] <= ROLE_MAX_RANK[role]


def filter_units(role: Role, units: list[EvidenceUnit]) -> list[EvidenceUnit]:
    """Applied BEFORE any text is sent to the model for a role's view."""
    return [u for u in units if can_read(role, u.label)]


def strictest(labels: list[AccessLabel]) -> AccessLabel:
    if not labels:
        return "contributor"
    return max(labels, key=lambda l: LABEL_RANK[l])


def claim_label(claim: Claim, units_by_id: dict[str, EvidenceUnit]) -> AccessLabel:
    return strictest([units_by_id[c.evidence_id].label
                      for c in claim.citations if c.evidence_id in units_by_id])


def claim_visible(role: Role, claim: Claim, units_by_id: dict[str, EvidenceUnit]) -> bool:
    """Visible only if EVERY cited evidence unit is readable and the claim is
    not sensitive / rejected / redacted (for non-leads)."""
    if claim.review_status in ("rejected", "superseded"):
        return False
    if role != "lead" and (claim.sensitive or claim.review_status == "redacted"):
        return False
    for c in claim.citations:
        u = units_by_id.get(c.evidence_id)
        if u is None or not can_read(role, u.label):
            return False
    return can_read(role, claim.label)


def visible_claims(role: Role, claims: list[Claim], units_by_id) -> tuple[list[Claim], int]:
    vis = [c for c in claims if claim_visible(role, c, units_by_id)]
    return vis, len(claims) - len(vis)  # hidden_count is a count only
