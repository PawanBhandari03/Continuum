"""Reconstruct pipeline: permission filter -> extract -> verify -> conflicts/gaps -> readiness."""
from __future__ import annotations
from dataclasses import dataclass, field
from .models import EvidenceUnit, Claim, Conflict, Gap, Readiness, Role
from .llm import Provider, support_all
from .visibility import filter_units, claim_label
from .verify import check_citations, build_claim
from .analysis import assign_sections, detect_conflicts, detect_gaps, compute_readiness

BATCH_SIZE = 35


@dataclass
class Result:
    claims: list[Claim] = field(default_factory=list)
    conflicts: list[Conflict] = field(default_factory=list)
    gaps: list[Gap] = field(default_factory=list)
    readiness: Readiness | None = None
    errors: list[str] = field(default_factory=list)
    dropped: int = 0


def run(units: list[EvidenceUnit], provider: Provider, role: Role = "lead",
        on_stage=lambda stage, pct: None) -> Result:
    """Generate claims for `role`. Evidence the role may not read never reaches the model."""
    res = Result()
    allowed = filter_units(role, units)
    by_id = {u.id: u for u in units}
    n = 0
    batches = [allowed[i:i + BATCH_SIZE] for i in range(0, len(allowed), BATCH_SIZE)]
    for bi, batch in enumerate(batches):
        on_stage("extract", int(100 * bi / max(1, len(batches))))
        ids = {u.id for u in batch}
        try:
            raws = provider.extract(batch)
        except Exception as e:  # never silently produce a partial handover
            res.errors.append(f"batch {bi + 1}/{len(batches)} failed: {type(e).__name__}: {e}")
            continue
        checked = [(raw, *check_citations(raw, by_id, ids)) for raw in raws]

        need = [i for i, (raw, cites, _) in enumerate(checked) if cites and not raw.inferred]
        verdicts = support_all(provider, [(checked[i][0].statement, [c.quote for c in checked[i][1]])
                                          for i in need])
        supports: list[str | None] = [None] * len(checked)
        for i, v in zip(need, verdicts):
            supports[i] = v
            if v is None:
                checked[i][2].append("support check failed")
        for (raw, cites, problems), support in zip(checked, supports):
            n += 1
            claim = build_claim(raw, f"cl_{n}", cites, support, problems)
            if claim is None:
                res.dropped += 1
                continue
            claim.label = claim_label(claim, by_id)
            if any(r.kind in ("secret", "pii") for c in claim.citations
                   for r in by_id[c.evidence_id].redactions):
                claim.sensitive = claim.sensitive or claim.label == "lead_only"
            res.claims.append(claim)
    on_stage("conflicts_gaps", 90)
    assign_sections(res.claims)
    res.conflicts = detect_conflicts(res.claims, provider)
    gap_claims, res.gaps = detect_gaps(res.claims, allowed)
    res.claims.extend(gap_claims)
    res.readiness = compute_readiness(res.claims, res.conflicts, res.gaps)
    on_stage("conflicts_gaps", 100)
    return res
