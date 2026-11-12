# 05 — Improvement 3: Sensitive-data protection

**Promise (Round 2 form):** a redaction review queue, a Guest role, a full audit log of views, approvals and exports,
and verified login with the database enforcing access.

**Judge must see:** Redaction queue lists every masked item with its detector → reviewer keeps/unmasks/escalates
one; Guest view shows only public claims and no exports; Activity page shows views and exports with a
"Verify integrity: chain intact (214 entries)" check; optional: sign in with a magic link.

Order of build (cut from the bottom): 3a detectors + queue → 3b Guest → 3c audit chain → 3d signed export → 3e real login.

---

## 3a. Detectors and redaction review queue

**New detectors** in `api/app/protect.py` (kinds extend `secret | pii | manual` with a `detector` name):
| detector | pattern idea | kind |
|---|---|---|
| pan | 5 letters, 4 digits, 1 letter (`[A-Z]{5}[0-9]{4}[A-Z]`) | pii |
| aadhaar | 12 digits in 4-4-4 groups, first digit 2–9, **Verhoeff checksum** must pass (cuts false positives) | pii |
| upi_id | `name@handle` where handle in known list (okaxis, oksbi, okhdfcbank, okicici, ybl, ibl, axl, paytm, upi, apl …) — checked before generic email | pii |
| ifsc / bank account | `[A-Z]{4}0[A-Z0-9]{6}` near 9–18 digits | pii |
| jwt | `eyJ…\.eyJ…\.…` | secret |
| private key block | `-----BEGIN … PRIVATE KEY-----` | secret |
| env line | `^[A-Z_]{3,}=(\S{8,})` in notes/code | secret |
| url with token | `?token=`, `?key=`, `?sig=` | secret |
| people-sensitive (suggest only) | performance/health/HR words near a person's name ("misses deadlines", "medical", "warning letter") | suggestion → lead-only |
Existing email/phone stay. Phone regex tightened for Indian formats (+91, 10 digits starting 6–9) to cut false hits.

**Queue** — table `redaction_reviews`: `id, handover_id, evidence_id, start, end, detector, kind, preview (masked context ±30 chars), decision (pending | keep_masked | unmask | escalate_lead_only | added_manual), decided_by, decided_at, reason`.
- Filled at ingest for every span; people-sensitive suggestions enter as `pending` with no mask yet.
- `GET /handovers/{id}/redactions?status=pending` (lead only). Response never contains the raw secret — only
  masked preview, detector and length. (Unmask decision applies to an obvious false positive, e.g. a public
  support email; the raw value is never sent to the browser for secrets.)
- `POST /redactions/{id}/decide` `{decision, reason}`; `POST /evidence/{id}/redact` `{start, end, reason}` for manual masks.
- `escalate_lead_only` sets the evidence unit label to lead_only → claims citing it recompute label (strictest) → they disappear from contributor/guest views on the next publish.
- Publish gate: pending people-sensitive suggestions are **blocking**; pending secret/pii spans are warnings (they are already masked).

**Exit answers:** `POST /gaps/{id}/answer` and task answers run the detectors; any `secret` hit → 400 "This looks like a
password or key. Say who holds it instead." (Bramhastra parity). PII is masked and stored.

**UI (Rahul):** new lead tab "Privacy" — summary counters (secrets masked, personal data masked, suggestions to review),
list grouped by source, each row: masked preview with the span shown as a labelled pill, detector name, buttons
(Keep masked · Not sensitive (unmask) · Make whole source lead-only); reason required for unmask/escalate.

## 3b. Guest role
- Roles become `lead | contributor | leaver | guest`; label rank: guest reads `public` only.
- Guest permissions: read published view and evidence for public claims; no export, no ack, no tasks, no evidence context
  neighbours beyond the cited unit, no version list beyond latest.
- Demo data: the CampusKart GitHub source becomes `public` (it is a public repo); chat stays contributor; mentor notes lead-only.
  Migration for the stored run: relabel github evidence units → recompute claim labels. Result: Guest sees a meaningful
  but smaller handover ("N items hidden by your access level").
- Landing: add a 4th, smaller entry "Enter as Guest (public view)". `models.LABEL_RANK/ROLE_MAX_RANK`, `visibility.py`,
  RLS function `app_role_rank()` (guest = 0) all updated together.

## 3c. Tamper-evident audit log (views, approvals, exports)
Table `audit_log` (replaces reading `review_actions` for the Activity page; keep review_actions for diffs during transition):
`seq bigserial, handover_id, at, actor, role, action, target_type, target_id, summary, meta jsonb, prev_hash, hash`.
- `hash = sha256(prev_hash || canonical_json(row without hash))`; `prev_hash` of the first row = sha256("continuum-genesis:" + handover_id).
- Database guard: trigger raising an exception on UPDATE/DELETE of `audit_log` (append-only even for the service role,
  except demo reset which deletes and re-creates the genesis row — documented, and reset itself is logged first).
- **What is recorded** (new: views and exports):
  - view: successor/guest opens Start here (once per session per version), opens evidence drawer (claim id);
  - export: markdown/PDF/print/zip with version and hash;
  - approvals, edits, rejections, redaction decisions, conflict actions, task actions, publish, ack/flag, role entry (demo).
- Writes are off the request path where possible (fire-and-forget thread with retry) so views stay fast; ordering by seq.
- `GET /handovers/{id}/audit?action=&actor=&since=` (lead), `GET /handovers/{id}/audit/verify` → `{ok, entries, broken_at?}`,
  `GET /handovers/{id}/audit.csv`.
- **UI:** Activity page gets filters (action type, person, date), "Views" and "Exports" categories, CSV download, and a
  "Verify integrity" button showing result with entry count; demo button "Simulate tampering" is NOT added (would undermine the guard).

## 3d. Signed export
- Exports (Markdown/PDF/print) read from a published snapshot and print: version, published_by/at, snapshot sha256,
  viewer role, export time.
- New "Verify an export": upload the Markdown export → server recomputes the snapshot hash from the stated version and
  compares the embedded hash + content checksum → "Matches v2 as published" / "Modified".
- Each export writes an audit row.

## 3e. Verified login with database-enforced access (cut-able)
Keep the one-click demo exactly as is for judges. Add real accounts for anyone creating their own handover:
- Supabase Auth: email magic link (no password storage by us). Page `/signin`.
- Table `handover_members (handover_id, user_id, role)`; creator becomes lead; lead invites by email → member row.
- API: if `Authorization: Bearer <supabase JWT>` is present, verify signature (Supabase JWKS), look up the member role
  for that handover (never trust a role claim from the client), and **perform reads with the user's JWT** against PostgREST
  so the existing RLS policies apply (update policies to use `handover_members` instead of `profiles.role`).
  Service key only for the worker and for writes after the API's own check.
- Demo handover h_1 keeps header roles; header roles are refused on any handover that has members.
- Tests: RLS test calling PostgREST directly with a contributor JWT cannot read lead_only evidence (proves DB enforcement).
- If this is not done by hour 60: ship 3a–3d, document 3e honestly as "designed, not shipped" with the reason.

## Acceptance tests
- [ ] Planted PAN, Aadhaar (valid checksum), UPI id, JWT in demo notes are masked; an invalid-checksum 12-digit number is not.
- [ ] Queue lists them; unmask requires reason; escalate makes claims vanish for contributor after publish.
- [ ] Exit answer containing `sk_test_…` is refused with 400.
- [ ] Guest sees only public claims; export/ack/tasks return 403; hidden count shown.
- [ ] Audit records a successor view and an export; verify passes; a manual DB edit (test DB) makes verify fail at that seq.
- [ ] Export shows the snapshot hash; verify-export detects a one-character change.
- [ ] (3e) Contributor JWT cannot read lead-only rows directly from PostgREST.
