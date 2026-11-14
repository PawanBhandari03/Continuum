"""Pydantic models mirroring web/lib/types.ts (the agreed data contracts)."""
from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field

AccessLabel = Literal["public", "contributor", "lead_only"]
Role = Literal["lead", "contributor", "leaver", "guest"]
EvidenceState = Literal["verified", "inferred", "conflicting", "missing", "confirmed"]
ClaimType = Literal["decision", "risk", "dependency", "owner", "next_action",
                    "open_question", "fact", "gap"]
SectionKey = Literal["project", "state", "decision_log", "first_week", "risks",
                     "dependencies", "unresolved"]

# Higher number = more restricted.
LABEL_RANK = {"public": 0, "contributor": 1, "lead_only": 2}
# Highest label rank each role may read.
ROLE_MAX_RANK = {"lead": 2, "contributor": 1, "leaver": 1, "guest": 0}


class Redaction(BaseModel):
    start: int
    end: int
    kind: Literal["secret", "pii", "manual"]
    detector: str = ""


class EvidenceUnit(BaseModel):
    id: str
    source_id: str
    author: str
    timestamp: str
    text: str
    locator: str
    label: AccessLabel = "contributor"
    redactions: list[Redaction] = Field(default_factory=list)
    flags: list[str] = Field(default_factory=list)


class Citation(BaseModel):
    evidence_id: str
    quote: str
    support: Literal["full", "partial"] = "full"


class Claim(BaseModel):
    id: str
    handover_id: str = "h_1"
    type: ClaimType
    statement: str
    state: EvidenceState
    confidence_reason: str = ""
    workstream: str = "general"
    entity_key: str = ""
    owner: Optional[str] = None
    label: AccessLabel = "contributor"
    review_status: Literal["pending", "approved", "edited", "rejected", "redacted", "superseded"] = "pending"
    sensitive: bool = False
    section: SectionKey = "state"
    date: Optional[str] = None
    citations: list[Citation] = Field(default_factory=list)
    conflict_id: Optional[str] = None
    version: int = 1
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[str] = None
    method: Literal["model", "rules", "human"] = "model"


class Conflict(BaseModel):
    id: str
    claim_ids: list[str]
    summary: str
    resolution: Literal["open", "kept", "both_true", "corrected", "deferred"] = "open"
    resolved_by: Optional[str] = None
    note: Optional[str] = None
    entity_key: str = ""
    kind: Literal["value", "staleness", "ownership"] = "value"
    severity: Literal["blocking", "warning"] = "blocking"
    detected_by: str = "model"
    resolution_claim_id: Optional[str] = None
    decided_at: Optional[str] = None
    label: AccessLabel = "contributor"


class Gap(BaseModel):
    id: str
    claim_id: str
    question: str
    evidence_found: list[str] = Field(default_factory=list)
    status: Literal["open", "answered", "skipped"] = "open"
    answer: Optional[str] = None
    answer_evidence_id: Optional[str] = None


class Readiness(BaseModel):
    score: int
    formula: str
    slots_filled: int
    slots_total: int
    open_conflicts: int
    open_gaps: int
    deferred_conflicts: int = 0


# What the model returns before verification.
class RawCitation(BaseModel):
    evidence_id: str
    quote: str


class RawClaim(BaseModel):
    type: ClaimType
    statement: str
    workstream: str = "general"
    entity_key: str = ""
    owner: Optional[str] = None
    date: Optional[str] = None
    inferred: bool = False
    method: Literal["model", "rules", "human"] = "model"
    citations: list[RawCitation] = Field(default_factory=list)
