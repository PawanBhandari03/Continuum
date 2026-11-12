# Round 3 build book — Continuum (start here)

**Window:** Fri 13 Nov 23:59 IST → Mon 16 Nov 23:59 IST (72 h). Hour 0 = 13 Nov 23:59. **Target submit: hour 68.**
**Rule:** all code is written inside the window. These files are designs, contracts and checklists only, written
before the window (allowed planning). They contain no implementation code on purpose.

**Judged (our notes):** Completeness 25 · Improvements delivered 20 · Reliability 20 · Usability/real-world fit 20 ·
Documentation/roadmap 15. Round 3 is measured against the three improvements we named in the Round 2 form.

| File | What |
|---|---|
| [01_COMPETITORS.md](01_COMPETITORS.md) | Field analysis and build/skip decision per feature |
| [02_SPEC_P0_RELIABILITY.md](02_SPEC_P0_RELIABILITY.md) | Rules fallback, injection guard, dates, permission holes, version semantics |
| [03_SPEC_IMP1_CONFLICTS.md](03_SPEC_IMP1_CONFLICTS.md) | Improvement 1 |
| [04_SPEC_IMP2_ACK_LOOP_DIFF.md](04_SPEC_IMP2_ACK_LOOP_DIFF.md) | Improvement 2 (+ frozen versions, Ask) |
| [05_SPEC_IMP3_SENSITIVE_DATA.md](05_SPEC_IMP3_SENSITIVE_DATA.md) | Improvement 3 |
| [06_SPEC_EXTRAS_AND_UI.md](06_SPEC_EXTRAS_AND_UI.md) | Extras (view-as, checklist, timeline, radar, CI) and UI plan + judge path |
| [07_TEST_PLAN.md](07_TEST_PLAN.md) | Tests, leak canary, failure cases, usability sessions |
| [08_SUBMISSION_DOCS_OUTLINE.md](08_SUBMISSION_DOCS_OUTLINE.md) | Final report, privacy/a11y, roadmap, video outline |

---

## Dependency order (what blocks what)

```
P0.4 permission holes ─┐
P0.5 version semantics ─┼─> 04 snapshots (handover_versions) ─┬─> 04 tasks + per-version acks + diff ─> E4 Ask
P0.1 rules fallback ────┘                                       ├─> 05 3d signed export
                                                                └─> 05 3c audit of views/exports
P0.3 dates ─> 03 staleness rule (needs real README/commit dates) ─> 03 clustering + resolve actions
05 3a detectors ─> 05 queue ─> (escalate) ─> visibility recompute
05 3b guest ─> needs public-labelled demo source (relabel github)
```
Critical path: **P0.5 → snapshots → tasks/diff.** Start it in hour 0.

## Data model changes (summary; details in each spec)
| Table | Change | Spec |
|---|---|---|
| handovers | `version` = latest published (0 before), new `revision`, new `leaver_available` | 02, 04 |
| claims | new `method` (model/rules); review_status adds `superseded` | 02, 03 |
| evidence_units | new `flags` jsonb | 02 |
| conflicts | entity_key, kind, severity, detected_by, N sides, new resolution values, resolution_claim_id, decided_at | 03 |
| conflict_events | new, append-only | 03 |
| handover_versions | new: snapshot + sha256 | 04 |
| tasks | new | 04 |
| acknowledgements | add `version`, `carried_over`; PK incl. version | 04 |
| redaction_reviews | new | 05 |
| audit_log | new, hash chain, update/delete blocked | 05 |
| handover_members | new (3e) | 05 |
| checklist_ticks | new (E2) | 06 |
All in one new migration file `supabase/migrations/0002_round3.sql` (written in the window), applied to Supabase, then
`/demo/snapshot` re-taken for h_1 so Reset restores the new shape.

## New / changed endpoints (contract summary — also update docs/contracts.md + web/lib/types.ts + mock)
| Method | Path | Who | Spec |
|---|---|---|---|
| GET | /handovers/{id}/conflicts (sides embedded) | lead (filtered for others) | 03 |
| POST | /conflicts/{id}/resolve (keep/both_true/correct/defer/reopen) | lead | 03 |
| GET | /conflicts/{id}/history | lead | 03 |
| POST | /handovers/{id}/publish → creates snapshot | lead | 04 |
| GET | /handovers/{id}/view?version=&draft=&as= | all (as/draft lead only) | 04, E1 |
| GET | /handovers/{id}/versions | all (filtered) | 04 |
| GET | /handovers/{id}/versions/{a}/diff/{b} (snapshot-based, role-filtered) | all | 04 |
| GET/POST | /handovers/{id}/tasks, /tasks/{id}/answer, /tasks/{id}/resolve, /tasks/{id}/attach | by role | 04 |
| POST | /handovers/{id}/ack (version-aware) | contributor, guest? no (guest read-only) | 04 |
| POST | /handovers/{id}/ask | contributor | 04 (E4) |
| GET | /handovers/{id}/notifications | all | 04 |
| GET | /handovers/{id}/redactions, POST /redactions/{id}/decide, POST /evidence/{id}/redact | lead | 05 |
| GET | /handovers/{id}/audit, /audit/verify, /audit.csv | lead | 05 |
| POST | /exports/verify | all | 05 |
| POST | /auth/* via Supabase; /handovers/{id}/members | members | 05 (3e) |
| GET/POST | /handovers/{id}/checklist | contributor | E2 |

## Timeline (hours from 13 Nov 23:59)
| Hours | Pawan (backend/AI) | Rahul (frontend/testing) |
|---|---|---|
| 0–3 | migration 0002; P0.5 version semantics; P0.4 permission fixes | update types.ts + mock-api shapes for all new endpoints (from this book) |
| 3–8 | P0.1 rules extractor + fallback; P0.2; P0.3 | Conflicts redesign on mocks |
| 8–14 | 04 snapshots + snapshot-based view/diff | Start here: version picker + diff panel on mocks |
| 14–22 | 03 detection rules + clustering + resolve actions + history | wire Conflicts to API; Tasks page on mocks |
| 22–30 | 04 tasks + per-version acks + notifications | Interview "from successor" tab; bell; wire loop |
| **30–32** | **checkpoint: Imp 1 + Imp 2 work end to end on live (simple form)** | live e2e of the loop |
| 32–42 | 05 3a detectors + queue + exit-answer refusal; 3b guest | Privacy page; guest entry; landing update |
| 42–50 | 05 3c audit chain + view/export events; 3d signed export | Activity page upgrade; export hash display |
| 50–56 | 05 3e login (or cut); leak canary suite; CI | e2e for all new flows, axe, 375 px |
| **56** | **checkpoint: all 3 improvements pass acceptance tests** | |
| 56–62 | extras E1, E2, E3 (E4/E5 only if green) | view-as banner, checklist UI, timeline UI; phone test; usability sessions |
| 62–68 | evaluation runs (model + rules), testing.md, report PDF, README update | demo video, screenshots, final UI fixes |
| 68 | **submit**; incognito check of every link | |
| 68–72 | buffer only — no new features | |

Commit and push small and often inside the window (history should show steady work). Pull before every push.

## Cut rules (in order, if behind)
1. E5, E4, E3, E2 (keep E1 view-as — 2 h, high value).
2. 3e real login → document as designed-not-shipped.
3. 3d export verify (keep the hash printed on exports).
4. Ask the handover.
5. Diff at section level instead of field level.
**Never cut:** the three improvements in working form, frozen versions, citations, evidence states, review/approval,
permission filter + leak canary, no-login judge path, rules fallback.

## Before hour 0 (non-code, allowed now)
- [ ] Seat confirmed and paid (receipt saved).
- [ ] Rahul has read 00, 03 (UI part), 04 (UI part), 05 (UI part), 06, 07 §3.
- [ ] Render API + web up; Supabase project up; Gemini key valid; UptimeRobot green.
- [ ] Local: `git pull`, API tests pass, web tests pass (baseline before changes).
- [ ] Decide who records the demo video and when (hour 62–66).
- [ ] Line up 3–5 usability participants for hours 56–64.
