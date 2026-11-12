# 04 — Improvement 2: Acknowledgement loop + version diff

**Promise (Round 2 form):** "unclear" flags route back to the reviewer and leaver as tasks while the leaver is still
reachable, and the product shows what changed between versions (claims added, edited, rejected, with before and after text).

**Judge must see (2 minutes):** Successor flags "Your first week" as unclear with a note → Leaver sees it in their
inbox and answers → Reviewer sees the answer, edits/approves, publishes v2 → Successor opens the handover, sees
"2 things changed since you acknowledged v1", the diff with before/after, and re-acknowledges only that section.

---

## Foundation: frozen published versions (required by this improvement)

Today the successor view reads live claims, so "what changed" cannot be computed honestly and edits leak into a
published handover. New:

Table `handover_versions`: `handover_id, version (int), published_at, published_by, snapshot jsonb, sha256 text, notes text`.
- **snapshot** = every non-rejected, non-superseded claim with section, state, statement, citations (ids + quotes),
  label, sensitive flag, review status, confirmed_by/at; plus conflicts (state, sides) and open gaps; plus
  readiness. Labels stay in the snapshot so each role's view is filtered at read time (one snapshot per version,
  not per role).
- **sha256** of the canonical JSON (sorted keys, no whitespace). Shown in the UI and printed on exports (05).
- Publishing = create snapshot N+1, set `handovers.version = N+1`, status `published`.
- Editing after publish: allowed (status → `in_review`, "Draft of v3 in progress") while successors keep reading the
  latest published snapshot. This replaces the "locked forever" behaviour (lock stays per version: a snapshot never changes).
- `GET /handovers/{id}/view` reads the latest snapshot (or `?version=N`). Lead can request `?draft=1` for preview.

## Tasks (the loop)

Table `tasks`: `id, handover_id, kind (unclear_flag | successor_question | conflict_followup), section, claim_id?, text,
raised_by, raised_role, assigned_to (leaver | lead | both), status (open | answered | resolved | wont_fix),
answer, answer_by, answer_evidence_id, resolution_note, version_raised, version_resolved, created_at, updated_at`.

Flow:
1. **Flag** — successor on a published version clicks "This is unclear" on a section (optionally on a specific claim)
   and writes what is unclear (required, min 5 chars). Creates task `assigned_to = both`; ack row status `unclear`.
2. **Leaver inbox** — Gap Interview page gets a second tab "From Karan (2)". Leaver answers in text → answer stored as
   Exit Q&A evidence unit (same mechanism as gap answers; secret check applies, 05) → task `answered`.
   If the leaver is gone (`handovers.leaver_available = false`), the task goes to the lead only.
3. **Reviewer inbox** — new "Tasks" tab (lead): list with filters; for each answered task the reviewer can
   (a) attach the answer to a claim as a new citation and edit the claim, (b) create a new claim from the answer
   (state confirmed, cites the Exit Q&A unit), or (c) resolve with a note ("already covered in X") / won't fix.
   Every action is audited.
4. **Publish v(N+1)** — publish gate adds: open tasks are warnings, not blockers ("1 successor question still open").
   Resolved tasks list "fixed in v{N+1}".
5. **Successor sees the change** — banner on Start here: "Updated to v2 since you last read · 2 sections changed ·
   your question about 'Your first week' was answered". Changed sections are marked; unchanged sections keep their
   acknowledgement automatically.

Notification: in-app only (no email). Header bell with a count per role: leaver = open tasks assigned to leaver;
lead = answered tasks + new flags; successor = answered questions + new version. Polls every 30 s on the handover pages.

## Acknowledgements per version

`acknowledgements` gets `version int`; primary key `(handover_id, section, actor, version)`.
- Ack/flag only allowed on a published version.
- When v(N+1) is published, for each section whose content hash (sorted claim ids + statements + states) is unchanged,
  copy the actor's v N acknowledgement forward as `carried_over = true`. Changed sections reset to `none`.
- Lead sees an **acknowledgement matrix**: sections × versions with ✓ / ⚑ / – and who/when.

## Version diff

`GET /handovers/{id}/versions/{a}/diff/{b}` rebuilt from snapshots (not from review_actions):
- match claims by id; a claim id missing in a = **added**; missing in b = **removed**; present in both with different
  statement / state / section / owner = **changed** (with field-level before/after); evidence added = **new evidence** count.
- group by section; include conflicts that changed state and tasks resolved between a and b.
- Role-filtered: a successor diff only includes claims visible to them in **both** versions (or in the one where it exists).
  A claim that becomes hidden appears as "1 item no longer visible to you" (count only).
- `GET /handovers/{id}/versions` returns published versions `{version, published_at, published_by, sha256, summary counts}`
  for everyone (role-filtered counts), and draft revisions (review action log) for the lead only.

## UI (Rahul)

- **Start here (successor):**
  - version picker "v2 (latest) · v1" ; "What changed since you read v1" panel (collapsible) with per-section diff
    cards: green "Added", amber "Changed" (before struck-through, after), grey "Removed";
  - per section: "I have read this" / "This is unclear" (note required) / after flag: "Flagged — waiting for answer"
    then "Answered by Aditi: …" inline;
  - progress: "5 of 7 sections acknowledged for v2 (4 carried over from v1)".
- **Leaver — Interview page:** tabs "Gap questions" | "From your successor"; same answer card style; secret warning.
- **Reviewer — Tasks page** (`/handovers/[id]/tasks`, new tab in HandoverNav): table/list with status chips, the
  successor's text, the leaver's answer, and three action buttons (Attach to claim · New claim from answer · Resolve).
  "Attach to claim" opens a claim picker filtered to the task's section.
- **Ledger:** banner "Published v1 · editing draft for v2 · 2 answered tasks waiting"; Version history modal shows
  published versions with hash + "Compare" (existing VersionCompare component upgraded to snapshot diff).
- **Header bell** component with popover list; keyboard accessible.

## Ask the handover (extension, build only if Imp 1–3 are green by hour 56)
Successor types a question. Server searches **only the latest published snapshot claims visible to that role**
(keyword + rapidfuzz scoring; optional model to phrase an answer that must cite claim ids, verified by code).
If top score below threshold → "The handover does not answer this" + button "Ask Aditi" → creates
`successor_question` task (same loop). Answers always list the claims and quotes used.

## Mock API
Seed one published v1 snapshot, one answered task, one v2 with a changed section, so the UI can be built before the
backend lands.

## Acceptance tests
- [ ] Publishing creates snapshot v1 with sha256; editing a claim afterwards does not change what the successor sees.
- [ ] Flag → task visible to leaver and lead; leaver answer → Exit Q&A evidence; lead attaches → claim changes in draft.
- [ ] Publish v2 → diff v1→v2 lists exactly the changed claim with before/after; unchanged sections' acks carried over.
- [ ] Successor diff never includes lead-only claims (leak canary).
- [ ] Ack on draft (unpublished) → 400; ack by lead → 403.
- [ ] Leaver unavailable → task goes to lead only.
- [ ] e2e full loop (contributor → leaver → lead → contributor) passes on mock and on live.
