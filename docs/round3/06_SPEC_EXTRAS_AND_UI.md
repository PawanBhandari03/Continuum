# 06 — Extras and the UI plan

Extras are built only after P0 and Improvements 1–3 pass their acceptance tests (checkpoint hour 56).
The UI plan applies throughout (Rahul).

---

## Extras (priority order)

### E1. View as (lead) — ~2 h, high value
Lead picks "Preview as Successor / Leaver / Guest" on Start here; calls `GET /view?as=contributor` (lead only), renders
exactly what that role gets, with a banner "Previewing as Guest — 31 items hidden". Proves permissions visually.

### E2. Day 1 / Week 1 checklist — ~3 h
Built by code from `next_action`, `dependency` (access to transfer) and `risk` claims in the published snapshot:
Day 1 = access/credentials/dependencies to obtain + blocking risks; Week 1 = next actions ordered by date/PR age;
Month 1 = open questions and deferred conflicts. Each item links to its claim; successor ticks items (stored per actor,
per version; audited). Lead sees progress. Replaces nothing — "Your first week" section stays.

### E3. Decision timeline — ~2 h
`decision` + settled conflicts + published versions on one vertical timeline by evidence date, role-filtered, each with
its source chip. Reuses existing data; new page tab "Timeline".

### E4. Ask the handover — see 04 (extension). ~4 h.

### E5. Knowledge-risk radar (stretch) — ~3 h
Per slot: number of distinct authors in its evidence; "single-person knowledge" when one author wrote all of it
(e.g. storage → Meera only). Lead-only page. Honest note: depends on authorship in sources.

### E6. CI — ~30 min
GitHub Actions: API pytest + web typecheck/unit/e2e (mock mode). Badge in README.

---

## UI plan (keep the plain blue/white system from Round 2)

### Navigation
- HandoverNav tabs for lead: Connect · Reconstruct · Review · Conflicts · **Tasks** · **Privacy** · Gap Interview · Activity · Start here (+ Timeline if E3).
  On mobile: horizontal scroll (exists) — add counts badges (Conflicts 1, Tasks 2, Privacy 3).
- Header: **notification bell** (04) between Help and Handovers.
- Landing: add Guest entry (small, under the three steps) + "Works without AI" line in the demo card.

### New/changed screens (each needs: loading skeleton, empty state, error state with retry, 375 px layout, axe clean)
| Screen | Owner of logic | Notes |
|---|---|---|
| Conflicts (redesign) | 03 | side-by-side, timeline strip, decision panel, history |
| Tasks (new, lead) | 04 | list + 3 actions + claim picker modal |
| Interview: "From your successor" tab | 04 | same card pattern as gap questions |
| Start here: version picker, "what changed", per-version ack, carried-over chips | 04 | biggest UI change |
| Privacy queue (new, lead) | 05 | grouped list, masked pills, reasons |
| Activity: filters, views/exports, verify, CSV | 05 | |
| View-as banner | E1 | |
| Checklist (successor) | E2 | |
| Sign in (if 3e) | 05 | separate from demo entry |

### Design rules (from Round 2 feedback)
- No purple, no gradients, single blue accent, slate neutrals; status colours only with icon + text.
- Every evidence state badge keeps icon + label.
- Primary action per screen is one solid blue button; destructive actions red outline + confirm.
- Use the existing components (`Card`, `Button`, `Notice`, `ClaimCard`, `ModalShell`, `EmptyState`, `LoadError`, `SkeletonList`).
- Copy: plain words; say what happens next ("Aditi will see this in her inbox").

### Patterns borrowed from the organiser's other winners (SpareSlot, EquipSync, SpareLook, ShareLab; checked 12 Nov)
| Pattern | Seen in | Our version |
|---|---|---|
| **"Judge's tour" as a top-nav page** with numbered steps and one-click "Sign in as" per step | SpareSlot | `/tour` page: the 6-step judge path, each step a button that switches role and opens the right screen; keep the modal tour too |
| **"What needs your attention" home per role** (count tiles: Decide · Today · Settle) from one API call | SpareSlot | Role homes: Reviewer tiles (open conflicts, answered tasks, privacy items, pending claims); Leaver (questions waiting); Successor (new version, answered questions, sections to acknowledge). Endpoint `GET /handovers/{id}/home` |
| **Blocked actions explain themselves** ("X is not possible yet: reason"), server decides which buttons show | SpareSlot | Publish, Ack, Resolve show the exact rule that blocks them with a link to fix it (partly exists for publish) |
| **Mandatory reason on every human decision** | SpareSlot, ShareLab | already for conflicts; extend to reject, unmask, escalate, resolve task |
| **"Advice only" automated suggestion, person decides** | SpareSlot (deposits), ShareLab | conflict side suggestion ("newer activity suggests Vercel — your call"), people-sensitive suggestion in Privacy |
| **Hero with small live product preview cards + trust badge row** | EquipSync | we have example claim cards; add a badge row (Every claim cited · Works without AI · Tamper-evident log · Role-filtered) |
| **FAQ on the landing** | EquipSync | 5 questions: what the AI does, who sees what, what if sources disagree, where data lives, what it costs to run |
| **README status table: Implemented / Partial / Not verified + dated test report** | SpareLook | add to README and PDF; only list runs we executed |
| Tabs kept in the URL (`?tab=`) so links target them | SpareSlot | ledger filters and Start-here version in the URL |
| Dark mode toggle | EquipSync | **skip** (user asked for a plain light UI) |

### Judge path (written on landing and in the tour)
1. Enter as Reviewer → Conflicts → keep Vercel side → note → Confirm.
2. Privacy → see PAN/Aadhaar/key masked → escalate mentor note (already lead-only) → Publish v1.
3. Enter as Successor → read, flag "Your first week" unclear.
4. Enter as Leaver → answer it.
5. Reviewer → Tasks → attach answer → Publish v2 → Successor sees "what changed" and re-acknowledges.
6. Guest → sees the public subset. Activity → Verify integrity.
Target: under 5 minutes, no typing beyond two short notes. The guided tour gets one step per item.
