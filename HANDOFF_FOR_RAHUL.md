# HANDOFF — Continuum (CodeFrontier Round 2: The Build)

**For:** Rahul Bramhankar and his Claude. **From:** Pawan Singh Bhandari (team lead) and his Claude.
**Read this whole file first.** It is self-contained. Also read `CLAUDE.md` and `PROJECT_OVERVIEW.md` in the repo for background.
Repo: https://github.com/PawanBhandari03/Continuum

---

## 0. TL;DR
We are Team **BINARY BUILDERS**. We are building **Continuum — "Project handovers that show their work."** A system that turns a leaving team member's scattered project activity (GitHub repo, team chat, notes, issues) into a handover where **every statement links to its source**, uncertainty is marked, the leaver answers only the questions evidence can't, a reviewer approves, and the successor sees only what their role is allowed to see.

**Window: Sun 8 Nov 10:00 IST → Wed 11 Nov 10:00 IST (72 h). It is open NOW.** Only Pawan submits the final form. Target: submitted by ~11 Nov 04:00 IST.

**What wins:** the central workflow must run end to end on a live link a judge can use with no sign-in and no walkthrough. "A visually polished interface cannot compensate for missing evidence, unreliable output or a broken handover process."

---

## 1. Hard rules (do not break; disqualification risk)
1. **All code written inside the window** (from 8 Nov 10:00). Commit history and file metadata are checked. Commit small and often with meaningful messages. Don't paste in old code from other projects.
2. **Disclose AI use** (Claude/Claude Code etc.), templates, boilerplate, libraries, services in `README.md`. Keep that section current.
3. **Synthetic / public / permissioned data only.** All demo secrets and personal details must be obviously fake (e.g. `sk_test_FAKE_...`, `+91-00000-00000`, `example.com`).
4. **No secrets in git.** `.env` files in `.gitignore`; commit `.env.example` with variable names only.
5. **No gaming automated judges** (no hidden text, no prompt-injection aimed at judges).
6. **Honesty:** never claim measured numbers we didn't measure. State limitations. Nothing is shown as "Verified" unless the check passed.
7. Both of us must understand the whole system; judges may question either of us.
8. Every link we submit must open **without sign-in**. Test in incognito. (Teams were eliminated in Round 1 over this.)

---

## 2. How we are scored (design decisions should follow this)
### Round 2 (100 pts) — what we are being judged on NOW
| Criterion | Pts | What it means for us |
|---|---|---|
| Core workflow runs end to end | **30** | Connect → Reconstruct → Verify → Review → Handover works on the live link |
| Technical depth and reliability | **25** | Real pipeline, citation verification, permissions that actually work, error handling |
| Progress against the plan | **20** | Matches Round 1 proposal; changes explained honestly |
| Three planned improvements | **15** | Three *substantial, non-cosmetic* things promised for Round 3 |
| Usability so far | **10** | Judge can use it unaided; clear states and labels |

**Round 2 submission (leader only):** working project link · source repo link · updated project PDF · list of completed features · technology & implementation details · explanation of changes from original plan · three major Round 3 improvements. Plus (our own plan): testing/feedback evidence, API/model/library list.

### Round 3 (for context, 13–16 Nov unconfirmed): Completeness 25 · Improvements delivered 20 · Reliability 20 · Usability & real-world fit 20 · Documentation & roadmap 15. "Trustworthy limitations score better than unsupported claims of complete automation." Judges assess what is *demonstrated*.

### Official problem statement (Problem 01)
**Prevent Critical Knowledge From Leaving With People.** Build a system that converts scattered project activity into a usable handover when a team member leaves. It must reconstruct project state from **authorised sources**: decisions, unresolved questions, responsibilities, risks, dependencies, next actions. Every generated summary must **link to its source** and **mark uncertainty, missing evidence or conflicting information**. Users must be able to **review, correct and approve before sharing**. It must reduce transition time **without exposing information the incoming person isn't authorised to see**.
Required workflow: **01 Connect → 02 Reconstruct → 03 Verify → 04 Review → 05 Handover.**
Trust requirements: (1) don't present assumptions as verified truth; (2) don't expose confidential info just because it appeared in a connected source; (3) allow authorised users to correct, reject, approve the final handover; (4) synthetic/public/permissioned/anonymised data only.
Suggested capabilities: import from docs/repos/tasks/notes/chat; highlight missing/contradictory info instead of inventing; timeline of decisions; handover views by role/permission; ownership/dependency/blocker/recurring-problem/next-action identification; review, correction, approval, version history, acknowledgement of receipt; citations; access controls, redaction, secure handling.

---

## 3. The product (what we build)
**Users/roles:** Lead/Reviewer (sees everything, approves) · Contributor/Successor (sees only permitted claims) · Leaver (answers Gap Interview) · (Round 3: Guest, Admin audit.)
**Setting:** small software teams (3–25), mainly student tech clubs/college project teams.

### Four differentiators
1. **Claims, not summaries** — handover is built from atomic claims, each with an evidence state and source links.
2. **Gap Interview** — leaver answers a short list of targeted questions only where evidence is missing/conflicting; answers become new citable evidence ("Exit Q&A").
3. **Permission before generation** — access labels applied before text reaches the AI; Postgres row-level security enforces it.
4. **Handover as a loop** — successor acknowledges each section or flags it "unclear"; flags route to reviewer + leaver.

### Evidence states (UI badges — must be visually distinct AND not colour-only for accessibility)
| State | Meaning |
|---|---|
| **Verified** | A source states it directly AND an automated check confirms support |
| **Inferred** | Reasonable conclusion not stated in any source; text carries "AI inference — not stated in any source" |
| **Conflicting** | Sources disagree; both shown side by side; never auto-resolved; newest NOT assumed correct |
| **Missing** | Something needed has no evidence; listed as gap → Gap Interview question |
| **Confirmed** | A human reviewer approved/corrected it (record who + when) |

### Handover contents (successor's "Start here" page)
1. Project in five lines · 2. Current state by workstream · 3. Decision log (timeline with reasons) · 4. Your first week (ordered next actions linked to issue/PR/thread) · 5. Risks and landmines · 6. Dependencies and people · 7. Still unresolved (open questions + conflicts, stated honestly).

### Workflow
1. **Connect:** reviewer creates handover (leaver, successor, successor's role, target date); connects GitHub repo (read-only token), uploads chat export, notes, issues; sees per-source status (ok / partial / failed + reason).
2. **Reconstruct:** background job extracts claims, builds timeline, ownership map, risks, dependencies, next actions.
3. **Verify:** citations checked, states assigned, conflicts + gaps detected, **readiness score** computed (formula visible). Leaver answers Gap Interview; answers fold back as evidence.
4. **Review:** claim ledger — approve / edit / reject / mark sensitive / redact. Conflicts must be resolved or marked "unresolved — successor to follow up". Version history. Publish locks the approved version (blocked if unresolved conflicts unmarked).
5. **Handover:** successor opens Start here, clicks source chips to see original text in context, acknowledges sections or flags "unclear". Only claims whose evidence their role may read are shown.

---

## 4. Tech stack (decided)
| Layer | Choice |
|---|---|
| Frontend | Next.js (TypeScript, App Router), Tailwind CSS, shadcn/ui |
| Backend | Python 3.11+, FastAPI, Pydantic |
| DB / auth | PostgreSQL on Supabase, Supabase Auth, row-level security |
| AI | Anthropic Claude API, structured output via tool use (model name in one env var) |
| Python libs | PyGithub, pypdf, python-docx (optional), rapidfuzz, detect-secrets |
| Embeddings | multilingual-e5-small — **optional**, skip in Round 2 unless time |
| Jobs | Python worker polling a Postgres `jobs` table |
| Hosting | Vercel (web), Render (API + worker), Supabase |

Rejected: separate vector DB, LangChain-style agents (we use a small explicit testable pipeline).

---

## 5. Who builds what (60–70% / 30–40% split — CONFIRM WITH PAWAN)
The user asked that Rahul's Claude do most of the build. To make that safe, **everything is built against a fixed contract (section 6) with mock data first**, so nobody blocks anybody.

**Rahul + Rahul's Claude own (≈60–70%):**
- All of `web/`: auth + role routing, create-handover, connect-sources (with per-source status), reconstruct progress, claim ledger (filters, evidence-state badges, approve/edit/reject/redact/mark-sensitive, readiness score + formula, version history), evidence viewer drawer (source chip → original text in context with quote highlighted), Gap Interview page (leaver), successor Start-here view with acknowledge/"unclear", publish flow, **one-click demo login so judges need no sign-in**.
- Synthetic CampusKart **chat export + notes** (section 8).
- Mock API layer / fixtures so the UI works before the backend is live.
- User interviews + handover test (section 10), README disclosure, docs.
- Deployment of web (Vercel).
- If time allows and Pawan agrees: backend pieces that are mostly mechanical — chat-export parser, markdown/PDF notes parser, noise filter, review-action endpoints, ack endpoints, publish endpoint.

**Pawan + Pawan's Claude own (≈30–40%, the risky core):**
- `api/` pipeline: GitHub connector, evidence-unit schema, secret/PII scan, access labels, **Supabase migrations + RLS**, Claude extraction, citation verification (quote match + support check), conflict + gap detection, readiness score, Gap Interview question generation, FastAPI + worker + Render deploy, CampusKart **repo** with planted facts.

**Shared:** testing, docs, round documents, final submission (Pawan files the form).

**Ownership rule to avoid merge pain:** Rahul only edits `web/`, `demo-data/chat+notes`, `docs/user-research*`. Pawan only edits `api/`, `supabase/`. Both may edit `docs/`, `README.md` (small, frequent commits; pull before push).

---

## 6. Data contracts (build UI against these; Pawan's API returns exactly these)
IDs are strings (UUID). Timestamps ISO-8601. `label` ∈ `"public" | "contributor" | "lead_only"`.

**Role → what they see:** `lead` sees all; `contributor` sees `public`+`contributor`. A claim's label = the most restrictive label among its cited evidence. If the viewer can't see all cited evidence, they don't see the claim at all.

```jsonc
// Source (a connected input)
{ "id": "src_1", "type": "github|chat_export|notes|issues|exit_qa",
  "name": "CampusKart repo", "status": "ok|partial|failed|pending",
  "status_reason": "Rate limited after 300 commits", "default_label": "contributor",
  "unit_count": 412 }

// EvidenceUnit (one message / commit / PR / paragraph)
{ "id": "ev_123", "source_id": "src_1", "author": "aditi", "timestamp": "2026-08-14T10:22:00Z",
  "text": "Moving payments to UPI deep links, gateway needs merchant KYC we can't get.",
  "locator": "https://github.com/.../pull/87", "label": "contributor",
  "redactions": [ {"start": 40, "end": 52, "kind": "secret|pii|manual"} ] }

// Claim
{ "id": "cl_9", "handover_id": "h_1",
  "type": "decision|risk|dependency|owner|next_action|open_question|fact|gap",
  "statement": "Payments moved from card gateway to UPI deep links in August.",
  "state": "verified|inferred|conflicting|missing|confirmed",
  "confidence_reason": "Quote matches PR #87 body; support check: supports",
  "workstream": "payments", "entity_key": "payments", "owner": "aditi|null",
  "label": "contributor", "review_status": "pending|approved|edited|rejected|redacted",
  "sensitive": false, "section": "decision_log|state|first_week|risks|dependencies|unresolved",
  "date": "2026-08-14",
  "citations": [ { "evidence_id": "ev_123", "quote": "Moving payments to UPI deep links",
                    "support": "full|partial" } ],
  "conflict_id": null, "version": 3,
  "confirmed_by": null, "confirmed_at": null }

// Conflict
{ "id": "cf_1", "claim_ids": ["cl_4","cl_8"], "summary": "README says Render; commits since 2 Oct configure Vercel",
  "resolution": "open|resolved|unresolved_followup", "resolved_by": null, "note": null }

// Gap + Interview question
{ "id": "gp_1", "claim_id": "cl_20", "question": "Who owns the college SMTP account? We found two mentions but no owner.",
  "evidence_found": ["ev_77","ev_81"], "status": "open|answered|skipped",
  "answer": null, "answer_evidence_id": null }

// Readiness
{ "score": 72, "formula": "slots_filled(verified+confirmed)/total_slots*100 - 5*open_conflicts - 3*open_gaps",
  "slots_filled": 18, "slots_total": 25, "open_conflicts": 1, "open_gaps": 2 }

// Handover
{ "id": "h_1", "leaver": "aditi", "successor": "karan", "successor_role": "contributor",
  "target_date": "2026-11-30", "status": "draft|in_review|published",
  "version": 3, "approved_by": null, "published_at": null }

// Successor view (role-scoped)
{ "handover": {...}, "sections": [ { "key": "decision_log", "title": "Decision log",
   "claims": [ Claim, ... ], "ack": "none|acknowledged|unclear" } ],
  "hidden_count": 4 }   // number of claims withheld by permissions (count only, never content)

// Review action / audit
{ "id": "ra_1", "claim_id": "cl_9", "actor": "pawan", "action": "approve|edit|reject|redact|mark_sensitive|ack|flag_unclear",
  "before": {...}, "after": {...}, "at": "..." }
```

### API surface (Pawan serves; Rahul mocks identically)
- `POST /handovers` · `GET /handovers/{id}`
- `POST /handovers/{id}/sources` · `GET /handovers/{id}/sources`
- `POST /handovers/{id}/reconstruct` → `{job_id}` · `GET /jobs/{id}` → `{status, stage, progress, error}`
- `GET /handovers/{id}/claims?state=&type=&workstream=&review_status=`
- `PATCH /claims/{id}` body `{action, edited_statement?, note?}`
- `GET /claims/{id}/evidence` → citations with the full evidence unit text + surrounding context units
- `GET /handovers/{id}/conflicts` · `POST /conflicts/{id}/resolve` body `{resolution, note}`
- `GET /handovers/{id}/gaps` · `POST /gaps/{id}/answer` body `{answer}` (creates `exit_qa` evidence)
- `GET /handovers/{id}/readiness`
- `GET /handovers/{id}/versions` (history) · `POST /handovers/{id}/publish` (400 with reason if blocked)
- `GET /handovers/{id}/view` (role-scoped successor view) · `POST /handovers/{id}/ack` body `{section, status}`
Auth: Supabase JWT in `Authorization: Bearer`. Role comes from the `profiles` table.

**First task for Rahul's Claude:** create `web/lib/types.ts` from the contracts above, `web/mocks/*.json` fixtures (a full CampusKart handover with all five states, one conflict, two gaps, 3 versions), and an API client with a `USE_MOCKS` env flag. Switch to the real API when Pawan says it's up.

---

## 7. Screens (web/) — build in this order
1. **Login / demo entry** — buttons "Enter as Reviewer (Lead)", "Enter as Successor (Contributor)", "Enter as Leaver". No signup friction. This is what makes the judge link usable unaided. A short banner explains: "Demo project: CampusKart (synthetic data)".
2. **Handovers list + Create handover** — leaver, successor, successor role, target date. Pre-seeded CampusKart handover so judges see a finished example immediately.
3. **Connect sources** — GitHub repo URL + token field (read-only note), upload chat export / notes / issues; per-source status chips; incomplete sources shown prominently ("Partial: …"), never hidden. For the judge demo, a "Use CampusKart sample sources" button.
4. **Reconstruct progress** — stage list (Parse → Protect → Extract → Verify → Conflicts/Gaps) with live status; errors shown with reason.
5. **Claim ledger (reviewer)** — table/cards grouped by section; filter by state/type/workstream/review status; each row: statement, state badge, owner, date, source chips, review actions (approve / edit / reject / mark sensitive / redact). Top bar: **readiness score with expandable formula**, counts of open conflicts and gaps, **Publish** button (disabled with reasons when blocked). Version history drawer.
6. **Evidence viewer** — click a source chip → drawer/modal shows the original text in context (neighbouring messages/commit), the quoted span highlighted, author, timestamp, link to original, access label, support level. Show redactions as blocks.
7. **Conflict view** — both claims side by side with dates and quotes; actions: resolve (pick/rewrite with note) or "Mark unresolved — successor to follow up". Never auto-pick newest.
8. **Gap Interview (leaver)** — short list of questions, each showing "what we found / what's missing", text answer, skip. Progress indicator. Submitting updates the claim to Confirmed-pending-review.
9. **Successor "Start here"** — the 7 sections; claims with state badges and source chips; per-section "Acknowledge" and "This is unclear" (with optional note); shows "N items hidden by your access level" (count only). Unresolved section is honest and prominent.
10. **Admin/audit (Round 3)** — skip now.

**Design principles:** trust is the product. Evidence state always visible on every claim. Inferred text visibly marked. Source chips on every claim. Plain language. Works at laptop width; usable on phone. Accessible: not colour-only, keyboard focus, contrast, labels. Dark mode optional. Don't spend time on animation.

---

## 8. Demo dataset: "CampusKart" (synthetic; shared)
A campus marketplace app. Cast: leaver **Aditi**, successor **Karan**, others e.g. Rohan, Meera, Dev, mentor **Prof. Iyer** (lead-only notes).

**Pawan creates:** public GitHub repo `campuskart` with real commits/PRs/issues carrying the planted facts. **Rahul creates:** Slack/Discord-style JSON chat export (~300–500 messages over ~3 months) + 2–3 notes files (Markdown; one PDF). Keep everything consistent in dates and names with the planted facts. Add an **answer key** at `demo-data/ANSWER_KEY.md` (what a perfect system finds) so we can measure recall.

**Planted facts (each must be discoverable):**
1. **Decision (Verified):** Payments moved from card gateway to UPI deep links in August, PR #87, reason: merchant KYC not obtainable. Chat discusses the reason.
2. **Conflict:** README says deployed on Render; commits since 2 Oct configure Vercel. Neither is marked as authoritative.
3. **Gap (Missing):** college SMTP account used for verification emails — no owner named anywhere.
4. **Inferred risk:** PR #91 "temporary fix for login loop"; TODO in `auth/session.ts`.
5. **Dependency (Verified):** image uploads depend on a third-party bucket; credential held by one named person (Meera).
6. **Recurring problem:** "build fails on Windows path" raised 3 times across weeks, never fixed.
7. **Open question:** chat thread on keeping cash-on-delivery with no resolution.
8. **Next action:** PR #94 open, changes requested, stale for 3 weeks.
9. **Permission trap:** a `lead_only` mentor note (Prof. Iyer's candid feedback about a member + a fake API key like `sk_test_FAKE_51abc...` + fake phone `+91-00000-00000`). **Must never appear in the Contributor view.** Also appears as test for redaction.
10. **Noise:** bot messages ("Deploy succeeded"), "ok", "👍", join/leave events, which should be filtered.
Include some **Hinglish** messages ("bhai payment wala PR merge kar diya, UPI hi chalega abhi"). Use Slack's official export shape (channels folder with per-day JSON, `users.json`, `channels.json`) so the real parser is realistic; fields `user`, `text`, `ts`, `thread_ts`, `subtype`.

---

## 9. Pipeline spec (so the UI shows the right things; Pawan implements)
1. **Ingest:** parse → evidence units; drop noise (bots, reactions, very short); thread chat by `thread_ts`/time proximity; scan for secrets/PII (detect-secrets + regex for emails/phones) and redact; apply access label from source default / per-channel.
2. **Permission filter** before generation: only units the target role may read are sent to the model for that role's view.
3. **Extract:** batches of ~30–40 units with stable IDs; model returns claims only through a tool schema: type, statement, workstream, entity_key, citations (evidence_id + exact quote), `inferred` flag.
4. **Verify:** (a) IDs exist and were in the batch; (b) quote fuzzy-matches unit text (rapidfuzz ≥ ~85) else citation dropped; claim with no surviving citation → Inferred or dropped; (c) second narrow model call "supports / partially / does not"; only "supports" → Verified.
5. **Merge, conflicts, gaps:** group by entity_key; pairwise contradiction check on small groups; gap checklist (owner of each service/credential, deploy target, unowned PRs, unresolved questions, TODO in risky modules, recurring unresolved problems) → Missing claims + interview questions.
6. **Readiness score** as in contract, formula displayed.
7. **Failure handling:** each source reports ok/partial/failed + reason; retries with back-off; never silently produce a partial handover.

---

## 10. Testing + evidence (also scored: "testing/feedback evidence")
- **Planted-facts test:** how many of the 10 planted items found/flagged; share of shown claims with a valid citation (target: all). Record real numbers.
- **Permission test:** generate Contributor view; assert none of the lead-only text, fake key or fake phone appears anywhere (UI + API response).
- **Failure cases:** empty source, malformed export, GitHub timeout/rate limit, model returns invalid JSON.
- **User interviews:** ≥5 club leads / mentors / maintainers. Script: how do handovers happen today, what got lost last time, what would you need to trust an auto-generated handover, would you approve claims one by one, what must never be shown. Record date, role, 2–3 quotes, what we changed. **Real results only.**
- **Handover test:** one person answers a fixed set of questions about CampusKart with vs without Continuum; record time and correctness honestly.
Store in `docs/testing.md` and `docs/user-research.md`.

---

## 11. Timeline (hours from 8 Nov 10:00 IST)
- **0–2:** repo structure, env setup, contracts committed, `web/` scaffold, mock fixtures.
- **2–9:** Rahul: auth + role routing, create-handover, connect-sources, ledger layout w/ badges (on mocks). Pawan: migrations + RLS + seed users. Both: CampusKart data.
- **9–27:** Rahul: ledger actions, evidence viewer, version history. Pawan: connectors → evidence units, secret/PII scan.
- **25–36:** Pawan: extraction + citation verification. Rahul: successor view, Gap Interview.
- **★ Hour 36 gate: whole flow connected end to end with crude versions of every stage, on a deployed URL.**
- **36–48:** support check, conflicts, gaps, readiness; publish lock; acknowledgements.
- **48–60:** integration bugs, permission test, planted-facts test, failure cases, interviews logged.
- **60–68:** final deploy; incognito test of every link; updated project PDF; feature list; changes from plan; three Round 3 improvements; Pawan submits (~11 Nov 04:00 IST).
- **68–72:** buffer only. Do not start new features.

**Cut list if behind:** Trello out (never needed), DOCX out (Markdown/PDF only), one role view instead of two (keep the permission filter). **Never cut:** citations, evidence states, review and approval.

---

## 12. Round 3 improvements we promised (confirm wording in the Round 2 submission)
1. **Cross-source conflict resolution** — project-wide contradiction detection with a side-by-side resolution screen.
2. **Acknowledgement loop + version diff** — successor acknowledges or flags sections; flags route back; reviewers see v1→v2 changes.
3. **Sensitive-data protection** — auto secret/PII detection, redaction queue, extra roles (Guest), full audit log of views/approvals/exports; export approved handover as PDF/Markdown with citation links.
(Round 2 builds simple versions of conflicts and acks; Round 3 makes them substantial.)

---

## 13. Working agreements for Rahul's Claude
- Start with the thinnest end-to-end path on mocks; polish last.
- Commit small and often; message says what and why. Pull before push. Never force-push `main`.
- Update `PROJECT_OVERVIEW.md` build log (section 13) after each milestone; update the README disclosure whenever a tool/library/service is added.
- Don't invent facts, numbers or user quotes. If a feature isn't done, mark it so in docs.
- Ask Pawan before changing a contract field; contract changes go in `docs/contracts.md` in the same commit.
- Environment variable names go in `.env.example`: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_USE_MOCKS`.

## 14. Definition of done for Round 2 (checklist for the final hours)
- [ ] Live web link opens with no sign-in; demo entry buttons work.
- [ ] A judge can: see the seeded CampusKart handover → open ledger → click a source chip and see original text → resolve/mark a conflict → answer a Gap Interview question → approve/edit/reject a claim → publish → switch to successor and see only permitted claims → acknowledge/flag a section.
- [ ] Contributor view contains zero lead-only text (tested, documented).
- [ ] Every shown claim has citations; states displayed correctly; Inferred is labelled.
- [ ] Source failures surface visibly.
- [ ] Repo public, README with setup + AI/library disclosure, no secrets.
- [ ] Updated project PDF, feature list, changes-from-plan, three Round 3 improvements, test + interview evidence.
- [ ] Every submitted link tested in incognito.
