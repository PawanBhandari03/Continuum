# 01 — Competitor matrix and what we build because of it

Researched 12 Nov 2026 from public repos and READMEs (no logins, nothing run except loading public demo links).
Some repos may be from the organiser's other events that reuse this problem statement; finalist status unknown.
Numbers quoted are the teams' own claims unless marked "checked".

## The field

| Team / repo | Stack | Live link (checked 12 Nov) | Headline strengths |
|---|---|---|---|
| **Bramhastra** — deven065/Baton | Java Spring Boot, React, Postgres+pgvector | loads; sign-in page with demo people | Multi-tenant SaaS shape, offline extractor (23/25 planted facts, own eval), Ask the handover, Day1/Week1/Month1 checklist, ownership map, timeline, view-as, versions with SHA-256 + diff, signed export + verify, share with expiry/revoke, audit log of views/exports with CSV, knowledge-risk radar (bus factor), prompt-injection guard, refuses secrets in exit answers, 107 tests + CI |
| **ByteStorm** — Ritika-Bhati-2266/Baton | FastAPI + Jinja + SQLite | loads (slow cold start) | Fully offline deterministic extractor, 7 evidence labels incl. SINGLE_SOURCE / HUMAN_ASSERTED / QUOTE_FAILED, "Keep this side" conflict resolution, critical-gap publish gate, append-only audit, redaction preview, 90-second judge path, role tabs |
| **aayush-as69/Handover** | FastAPI + Jinja + SQLAlchemy | loads; **demo password required** | 190 commits, CI, immutable claim versions, numbered releases + acknowledgement, release diff, freshness view, bus factor, timeline, quality report vs gold set, 15 doc files |
| **PanavCodes/Handover-Ledger** | Next.js 14 | loads | 4 personas no login, "leak canary" permission suite (16/16), SHA-256 head-anchored audit chain, attestation endpoint, 28 vitest |
| **Epsilum** — ayushdotio/project-sanchaya | React+Vite, Node, Python, Mongo | **404** | Freshness "re-check recommended", bus-factor map, 7-point readiness checklist, citation PDF export |
| **WELCOME** — afrozkhan346/BATON | FastAPI + Next.js | none listed | Two-tier verification, own benchmark (permission leak rate) |
| relay-ai, may1102 BATON, others | various | load | Mostly seeded/mock connectors; heavy visual polish (3D hero) |

## Our position before Round 3

**We lead on:** real LLM extraction with code-checked quotes plus a second support check; lead-only text processed in a separate pass; no-login live link that loads fast; 37 browser + 27 API tests incl. axe; honest limitation docs; real GitHub + Slack-zip + PDF ingestion.

**We trail on:** (1) the demo depends on a free AI quota — two strong rivals run offline; (2) conflict UX (no "keep this side + history"); (3) "unclear" flags go nowhere; (4) no frozen published version — the successor reads live claims, so diff and signing are weak; (5) audit log is editable and does not record views/exports; (6) no Ask, checklist, timeline, view-as; (7) no CI badge.

## Feature-by-feature decision

| Capability | Who has it | Us now | Round 3 decision | Spec |
|---|---|---|---|---|
| Works with no AI key | ByteStorm, Bramhastra | no | **BUILD (P0)** rule extractor + fallback chain | 02 |
| Prompt-injection guard | Bramhastra | no | **BUILD (P0)** small | 02 |
| Correct dates (README, notes) | — | wrong | **FIX (P0)** | 02 |
| Hidden things return 404 | Bramhastra | 403 | **FIX (P0)** | 02 |
| Role checks on conflicts/gaps/versions/audit | all serious ones | missing (latent leak) | **FIX (P0)** | 02 |
| One card per disagreement, N sides | ByteStorm (topic key) | pairs, duplicates | **BUILD (Imp 1)** | 03 |
| Keep A/B, both, correct, defer + reason | ByteStorm, Bramhastra | keep one / defer | **BUILD (Imp 1)** | 03 |
| Staleness ("doc older than code") | Epsilum, Bramhastra (STALE) | no | **BUILD (Imp 1)** | 03 |
| Resolution history | Bramhastra (revisions) | overwritten | **BUILD (Imp 1)** | 03 |
| Frozen published version + hash | Bramhastra, aayush | no | **BUILD (Imp 2)** — needed for diff | 04 |
| Diff between versions, "what changed since you read" | Bramhastra, aayush | partial (edits only, live) | **BUILD (Imp 2)** | 04 |
| Unclear flag -> task -> answer -> new version | Bramhastra (ask->leaver) | flag only | **BUILD (Imp 2)** | 04 |
| Re-acknowledge only changed sections | — (nobody) | no | **BUILD (Imp 2)** — our edge | 04 |
| Ask the handover with citations | Bramhastra | no | **BUILD (Imp 2 extension)** if time | 04 |
| Redaction review queue | ByteStorm (preview only) | no | **BUILD (Imp 3)** | 05 |
| India-specific PII (PAN, Aadhaar, UPI ID, IFSC) | nobody | no | **BUILD (Imp 3)** — our edge for an Indian event | 05 |
| Refuse secrets in exit answers | Bramhastra | warning text only | **BUILD (Imp 3)** | 05 |
| Guest role | — | no | **BUILD (Imp 3)** promised | 05 |
| Audit of views/exports, hash chain, verify | Bramhastra, Panav | partial, editable | **BUILD (Imp 3)** | 05 |
| Real login + DB-enforced access | Bramhastra | header roles | **BUILD (Imp 3)**, cut-able, demo stays one-click | 05 |
| Signed export + verify | Bramhastra | export, unsigned | **BUILD (Imp 3)** small once snapshots exist | 05 |
| Leak-canary suite | Panav, ByteStorm | partial | **BUILD (Imp 3 / tests)** | 05, 08 |
| View as (lead previews a role) | Bramhastra | no | **BUILD (extra, cheap)** | 06 |
| Day 1 / Week 1 checklist | Bramhastra | "Your first week" section | **BUILD (extra)** | 06 |
| Decision timeline | Bramhastra, aayush | decision log list | **BUILD (extra)** | 06 |
| Bus factor / risk radar | Bramhastra, aayush, Epsilum | no | **MAYBE (stretch)** | 06 |
| CI badge (GitHub Actions) | Bramhastra, aayush | no | **BUILD (cheap)** | 08 |
| Multi-tenant SaaS, billing, Slack/Drive live connectors | Bramhastra | no | **SKIP** — not promised, high cost; say so in roadmap |
| Embeddings / semantic search | Bramhastra | no | **SKIP** (memory limits on free hosting) |

## How we win the comparison (story for judges)
1. **Same honesty, better evidence**: real model + deterministic checks, and it still works offline (rule mode labelled as such).
2. **Only one with a closed loop that respects the reader**: flag -> task -> answer -> new signed version -> successor re-acknowledges only what changed.
3. **India-aware privacy**: PAN/Aadhaar/UPI/IFSC detection, redaction review queue, tamper-evident audit.
4. **Zero-friction judge path**: no password, 5 clicks, works when the AI quota is gone.
