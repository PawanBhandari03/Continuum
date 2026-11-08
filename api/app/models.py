"""Pydantic models mirroring web/lib/types.ts (the agreed data contracts)."""
from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field

AccessLabel = Literal["public", "contributor", "lead_only"]
Role = Literal["lead", "contributor", "leaver"]
EvidenceState = Literal["verified", "inferred", "conflicting", "missing", "confirmed"]
ClaimType = Literal["decision", "risk", "dependency", "owner", "next_action",
                    "open_question", "fact", "gap"]
SectionKey = Literal["project", "state", "decision_log", "first_week", "risks",
                     "dependencies", "unresolved"]

# Higher number = more restricted.
LABEL_RANK = {"public": 0, "contributor": 1, "lead_only": 2}
# Highest label rank each role may read.
ROLE_MAX_RANK = {"lead": 2, "contributor": 1, "leaver": 1}


class Redaction(BaseModel):
    start: int
    end: int
    kind: Literal["secret", "pii", "manual"]


class EvidenceUnit(BaseModel):
    id: str
    source_id: str
    author: str
    timestamp: str
    text: str
    locator: str
    label: AccessLabel = "contributor"
    redactions: list[Redaction] = Field(default_factory=list)


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
    review_status: Literal["pending", "approved", "edited", "rejected", "redacted"] = "pending"
    sensitive: bool = False
    section: SectionKey = "state"
    date: Optional[str] = None
    citations: list[Citation] = Field(default_factory=list)
    conflict_id: Optional[str] = None
    version: int = 1
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[str] = None


class Conflict(BaseModel):
    id: str
    claim_ids: list[str]
    summary: str
    resolution: Literal["open", "resolved", "unresolved_followup"] = "open"
    resolved_by: Optional[str] = None
    note: Optional[str] = None


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
    citations: list[RawCitation] = Field(default_factory=list)
