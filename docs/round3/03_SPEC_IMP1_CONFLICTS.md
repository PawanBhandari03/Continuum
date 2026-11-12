# 03 — Improvement 1: Cross-source conflict resolution

**Promise (Round 2 form):** project-wide contradiction detection across sources and time, a side-by-side
resolution screen with evidence on both sides, and a resolution history, so reviewers settle disagreements
instead of deferring them.

**Judge must see:** one planted disagreement → one card → both sides with source, author, date and quote →
reviewer keeps one with a reason → successor sees the settled claim citing the winning evidence →
history shows who decided what and when.

---

## Data model changes (design)

`conflicts` table — new columns:
| column | type | meaning |
|---|---|---|
| entity_key | text | topic slot (deploy, payments, …) or entity name |
| kind | text | `value` (different values now) · `staleness` (older doc vs newer activity) · `ownership` (different owners) |
| severity | text | `blocking` (core slot) · `warning` |
| detected_by | text | `rules` · `model` · `rules+model` |
| claim_ids | text[] | now **N ≥ 2** sides (was always 2) |
| resolution | text | `open` · `kept` · `both_true` · `corrected` · `deferred` (replaces resolved/unresolved_followup; map old values) |
| resolution_claim_id | text | the Confirmed claim that records the outcome |
| decided_by, decided_at, note | | as today, note required for every non-open state |

New table `conflict_events` (append-only): `id, conflict_id, handover_id, at, actor, action (detected|kept|both_true|corrected|deferred|reopened), payload jsonb, note`.

## Detection (deterministic first, model second)

**Rule A — value conflicts.** For each core slot, a value dictionary:
- deploy: render, vercel, netlify, heroku, railway, fly.io, aws, gcp, firebase hosting
- payments: upi, card gateway, razorpay, stripe, paytm, cash on delivery/cod
- email: college smtp, gmail smtp, sendgrid, ses, mailgun, resend
- storage: s3, cloudinary, firebase storage, supabase storage, "bucket"
- auth: jwt, session cookie, firebase auth, supabase auth, oauth

For claims of type fact/decision/dependency/owner on the same slot, extract value tokens from the statement and quotes.
Two claims conflict if their value sets are disjoint and both describe the present (no past-tense marker:
"was", "earlier", "used to", "replaced", "moved from", "tested on preview/staging"). The model contradiction check
(when available) is then asked only about rule candidates and about same-slot pairs with no dictionary values.

**Rule B — staleness.** Same slot, one side from a *document* source (README, notes), the other from *activity*
(commits, PRs, chat), activity newer than the document's last change, values differ →
`kind = staleness`, summary "README (last changed 12 Sep) says Render; commits since 2 Oct configure Vercel".
This is our planted Render/Vercel case.

**Rule C — ownership.** Same entity, two claims naming different owners, both present tense → `kind = ownership`.

**Clustering (fixes duplicate cards).** Build a graph: claims are nodes, contradiction verdicts are edges. Each
connected component within one slot = **one conflict** with all its claims as sides. Never auto-resolve; never
prefer newest (but show dates prominently).

**Permissions.** A conflict's label = strictest label of its sides. Non-leads never receive a conflict they cannot
fully see (see 02 P0.4). Lead-only and contributor claims may be in the same conflict; it is then lead-only.

## Resolution actions (API)

`POST /conflicts/{id}/resolve` body (design):
- `action`: `keep` | `both_true` | `correct` | `defer` | `reopen`
- `keep_claim_ids` (for keep; usually one, may be several sides that agree)
- `scope_note` (for both_true: "Render hosts the API, Vercel the web app")
- `corrected_statement` (for correct)
- `note` (required, min 10 chars: who confirmed and why)

Effects:
| action | claims | new Confirmed claim |
|---|---|---|
| keep | kept sides → state confirmed, approved; other sides → `review_status = superseded` (new status; hidden from successor, visible in history) | statement = kept side; citations = kept sides' citations; confidence_reason "Conflict settled by {actor}: {note}" |
| both_true | all sides confirmed | statement = scope_note; citations = all sides |
| correct | all sides superseded | statement = corrected_statement; citations = all sides' citations (evidence that was weighed) + note |
| defer | sides stay conflicting | none; successor sees both under "Still unresolved" with "Follow up with {leaver/lead}" |
| reopen | restore previous states from history | new claim removed |
Every action appends `conflict_events` + audit (05) and bumps draft revision.

Publish gate: `open` blocks; `deferred` allowed but counted ("2 deferred conflicts will be shown as unresolved").
Readiness: open conflict −5 (as now); deferred −2.

Endpoints: `GET /handovers/{id}/conflicts` returns sides as full claim objects + evidence summaries
(source name, type, author, date, quote) so the UI needs one call; `GET /conflicts/{id}/history`.

## UI (Rahul) — `app/handovers/[id]/conflicts/page.tsx` redesign

- **List header:** counts by state (Open · Deferred · Settled), filter by slot, "blocking first".
- **Conflict card (collapsed):** slot badge, kind badge (Value / Out of date / Owner), one-line summary, sides count, status.
- **Expanded = side-by-side** (stacks on mobile):
  - each side column: source type icon + name, author, date (big), quote with the matching span highlighted,
    "Open source" (existing evidence drawer), evidence state chip;
  - between columns: a small timeline strip placing each side's date (shows README Sep → commits Oct);
  - staleness kind shows banner "The document is older than the activity that contradicts it."
- **Decision panel:** radio group: Keep this side (per side) · Both are true (scope) · Write the correct version ·
  Defer to successor. Required note field with example placeholder. Confirm button text changes with the choice.
- **Settled state:** green summary "Kept: Vercel (commits since 2 Oct). Decided by Reviewer on 14 Nov: …" + "History" disclosure listing conflict_events + "Reopen".
- **Ledger:** conflicting claims show "Part of conflict: deploy (open)" link (exists) — after settling, superseded sides
  show greyed with "Superseded by decision".
- **Successor view:** settled → normal Confirmed claim with a small "Settled conflict" note and both sources available
  in the evidence drawer; deferred → in "Still unresolved" with both sides.
- Accessibility: radio group with legend, focus moves to result after confirm, colour never the only signal.

## Mock API (web/lib/mock-api.ts)
Add the same shapes and seed: one staleness conflict (deploy, 2 sides), one value conflict (payments, 3 sides, of
which 2 are past-tense in real data → shows how rules reduce false conflicts), one ownership conflict.

## Acceptance tests
- [ ] CampusKart: Render/Vercel produces exactly **one** conflict, kind staleness, 2+ sides.
- [ ] Old "card gateway added" commit does **not** conflict with the UPI decision (past tense rule).
- [ ] keep → successor view shows one Confirmed deploy claim citing the commit; superseded side hidden from successor, visible to lead in history.
- [ ] both_true / correct / defer / reopen each produce correct claims and history rows.
- [ ] Note required; empty note → 400.
- [ ] Contributor cannot GET a conflict involving lead-only claims.
- [ ] e2e: open card → keep side → note → confirm → publish allowed.
- [ ] axe clean, 375 px layout.
