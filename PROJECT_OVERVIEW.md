# Continuum — Project Overview (living document)

*Team BINARY BUILDERS — Pawan Singh Bhandari (backend/AI), Rahul Bramhankar (frontend/design)*
*Last updated: 7 Nov 2026 (pre-build). Claude updates the "Build log" and "Current status" sections as we build.*

> How this file relates to the others: **CLAUDE.md** = instructions and rules for Claude (scope, deadlines, working agreements). **PROJECT_OVERVIEW.md** (this) = what we're building and how, for humans, updated as we go. **BUILD_PREP.md** = pre-window planning. **DAY1_PLAYBOOK.md** = exact steps for the first hours.

## 1. What Continuum is
**Tagline:** Project handovers that show their work.

When someone leaves a project team, their knowledge leaves with them. Continuum rebuilds the project's current state from its repo, team chat, notes and task board, and turns it into a handover where **every statement points to its source**. It asks the leaver only the questions the evidence can't answer, and lets a reviewer approve exactly what the successor is allowed to see.

Problem it answers (hackathon Problem 01): *Prevent critical knowledge from leaving with people.*
Target users: small software teams (3–25 people), especially student tech clubs where members rotate every semester.

## 2. The five-step workflow (what a judge must be able to do)
1. **Connect** — reviewer creates a handover (leaver, successor, role, date) and connects a GitHub repo, a chat export, notes, and issues.
2. **Reconstruct** — the system extracts atomic *claims* (decisions, risks, owners, dependencies, next actions, open questions).
3. **Verify** — every claim's citation is checked; claims get an evidence state; conflicts and gaps are detected; a readiness score is computed.
4. **Review** — a reviewer approves, edits, rejects, redacts or marks claims sensitive. Version history is kept. Publishing locks the version.
5. **Handover** — the successor opens a "Start here" page, clicks source chips to see the original text, and acknowledges or flags sections. They see only what their role may see.

## 3. The four ideas that make it different
1. **Claims, not summaries** — each claim has an evidence state and source links.
2. **Gap Interview** — the leaver answers targeted questions only where evidence is missing or conflicting; answers become citable evidence ("Exit Q&A").
3. **Permission before generation** — access labels are applied before text reaches the AI; Postgres row-level security enforces it in the database.
4. **Handover as a loop** — the successor's "unclear" flags route back to the reviewer and leaver while the leaver is still reachable.

## 4. Evidence states (the trust model)
| State | Meaning |
|---|---|
| Verified | A source states it directly AND an automated check confirms the source supports it |
| Inferred | Reasonable conclusion, not in any source; labelled "AI inference — not stated in any source" |
| Conflicting | Sources disagree; both shown; never auto-resolved; newest is not assumed correct |
| Missing | Something a handover needs has no evidence; becomes a Gap Interview question |
| Confirmed | A human reviewer approved/corrected it (who and when recorded) |

## 5. How it works (architecture)
```
Sources: GitHub API | Slack/Discord JSON export | notes (MD/PDF) | GitHub Issues | Exit Q&A
   -> Ingestion (Python worker): parse -> evidence units; secret/PII scan; access label
   -> Evidence store: PostgreSQL (+ pgvector later) on Supabase, row-level security
   -> Reconstruction (FastAPI + Claude API):
        1 permission filter -> 2 extract claims (schema-bound, must cite IDs)
        -> 3 verify citations (quote match + support check) -> 4 conflicts, gaps, readiness
   -> Next.js app: claim ledger/review | Gap Interview | role-scoped handover
```
**Trust pipeline in plain words:** the AI may only output structured claims that cite evidence IDs and quote the supporting text. We then check, with ordinary code, that the IDs exist and the quote really appears in the source. A second narrow AI call judges whether the source supports the claim. Only claims passing both can be "Verified". A human must approve before publishing.

**No leaking:** every evidence unit carries an access label; a claim takes the most restrictive label among its evidence; the successor's view is built only from what their role may read.

## 6. Tech stack
| Layer | Choice |
|---|---|
| Frontend | Next.js (TypeScript), Tailwind CSS, shadcn/ui |
| Backend | Python, FastAPI, Pydantic |
| Database/auth | PostgreSQL on Supabase, Supabase Auth, row-level security |
| AI | **Google Gemini API** (structured JSON output; model chain `gemini-3.5-flash` → `gemini-3.1-flash-lite` → `gemini-3.5-flash-lite` → `gemma-4-31b-it`). Changed from the Round 1 plan (Claude) because we had no usable Claude API credit. The model sits behind a swappable interface (`api/app/llm.py`), so Claude can be dropped back in. |
| Libraries | PyGithub, pypdf, python-docx (if time), rapidfuzz, detect-secrets |
| Embeddings | multilingual-e5-small — optional in Round 2 |
| Jobs | Python worker + Postgres job table |
| Hosting | Vercel (web), Render (API + worker), Supabase |

## 7. Demo data
Synthetic project **CampusKart** (campus marketplace app). Planted facts: UPI payments decision (PR #87), README-vs-Vercel conflict, ownerless college SMTP account, risky "temporary fix" in auth, a lead-only note that must never reach the Contributor view. All data is synthetic; secrets/PII in it are fake. Cast: leaver Aditi, successor Karan.

## 8. Roles in the product
Lead/reviewer (sees everything, approves), Contributor/successor (sees only permitted claims), Leaver (answers Gap Interview). Round 3 adds Guest and a full audit log.

## 9. Timeline
- Round 2 build: **8 Nov 10:00 → 11 Nov 10:00 IST**. Only Pawan submits. Judges must be able to use the live link without sign-in or walkthrough.
- Round 3: dates to be confirmed (earlier note: 13–16 Nov).
- **Code rule:** nothing but docs committed before 8 Nov 10:00. Disclose AI assistance in the README.

## 10. Three improvements promised for Round 3
1. Cross-source conflict resolution (side-by-side screen).
2. Acknowledgement loop + version diff (v1 → v2).
3. Sensitive-data protection: PII/secret redaction queue, Guest role, audit log, PDF/Markdown export with citation links.

## 11. Honest limitations (to keep updated)
- Built for small software teams; not tested at enterprise scale.
- Source coverage limited to GitHub, chat export, notes, issues.
- Automated verification reduces but doesn't eliminate wrong claims; human review is required.
- (Add real measured limitations here as we find them.)

## 12. Current status (9 Nov evening, about hour 36 of 72)
**Live now:** web https://continuum-web-kodb.onrender.com and API https://continuum-api-945j.onrender.com (Render free tier; first visit after idle takes about a minute). The whole workflow runs on the live site: connect (sample sources, GitHub, Slack zip and notes upload), reconstruct, verify, review (approve / edit / reject / redact, bulk approve), Gap Interview, publish lock, role-scoped successor view, acknowledge / flag unclear, audit page, export (Markdown / print), version compare.

**Backend:** pipeline (ingest, secret/PII masking, permission filter, citation verification, conflicts, gaps, readiness), GitHub connector, upload, audit, bulk approve, version diff, replay/reset for the demo, 27 unit tests. **Measured:** 7 of 8 planted facts found, 94 of 94 claims cited (`docs/evaluation.md`).

**Fixed after Rahul's live-site test (9 Nov):** approvals were 6-10 s each so a judge could not reach Publish; now one bulk request (about 3 s for all 94 claims) and about 1 s per single action. "Project in five lines" was empty; now filled from the best-supported Verified claims. One disagreement appeared as two conflicts; resolving one now settles both. Version diff endpoint added.

**Not done yet:** verified login (role is sent in a header), Guest role, redaction review queue, audit of views/exports, real-phone and 15-minute cold-start checks, interviews (survey of 6 done), live re-test after the fixes, pinger on 10 Nov evening, filling the [TODO]s in `docs/ROUND2_SUBMISSION.md`, submission (by about 04:00 IST 11 Nov).

## 13. Build log (Claude appends as we go)
| When | What was built / decided | Notes |
|---|---|---|
| 7 Nov | Planning docs written | No code |
| 8 Nov | `web/` scaffolded (Next.js 15, Tailwind v4), typed contracts in `web/lib/types.ts` | Rahul + Claude |
| 8 Nov | Mock API + CampusKart fixture (`web/mocks`, `web/lib/mock-api.ts`): five evidence states, 1 conflict, 2 gaps, versions, 2 lead-only claims | In-browser, persisted in localStorage; enforces the same permission rule as the real system |
| 8 Nov | All 8 screens built on the mock API (see section 14) | UI works end to end without keys |
| 8 Nov | `api/`: ingest, secret/PII masking, permission filter, citation verification, conflicts, gaps, readiness, with 22 tests | Pawan + Claude. Core logic, tested with a fake model first |
| 8 Nov | Supabase schema + row-level security applied (`0001_init.sql`), verified by reading every table | Live project |
| 8 Nov | Gemini provider; first real run on CampusKart: 23 model calls, 0 errors, ~50 claims | Switched from Claude plan to Gemini; free-tier quota (20/day/model) shaped the batching design |
| 8 Nov | FastAPI server + smoke test against live DB; `docs/contracts.md` | All permission/publish checks pass; not yet connected to the web app |
| 8 Nov | `web/tests/permissions.test.ts`: 17 checks (contributor view has no lead-only text/fake key/fake phone; publish gate) all pass | Tests the **mock** only. The real API/RLS needs its own test |
| 9 Nov | Task 1: first-run guided tour (8 steps, Help button, remembered in localStorage) + "Approve all remaining" on the ledger. Playwright e2e `web/tests/e2e/tour.spec.ts` follows only on-screen hints from a fresh browser context to published + acknowledged: 2/2 pass in system Chrome (mock mode) | Test caught a real bug (Esc closing the evidence drawer also closed the tour), fixed |

| 9 Nov | GitHub connector + CampusKart repo (script `demo-data/seed_campuskart_repo.py`; commit dates simulated and disclosed in the repo's NOTICE.md) | PR #87/#91/#94 numbering matches the chat |
| 9 Nov | Upload (Slack zip, notes) and audit endpoints; stored-run replay and reset for the demo | Replay protects the Gemini free-tier quota (about 20 requests per model per day) |
| 9 Nov | Deployed to Render (api + web). Fixes found by real-browser testing: role header on every call, evidence caching (94 parallel calls failed before), client request cap and retries, Slack-style locators | `web/tests/real-e2e.mjs` |
| 9 Nov | `docs/user-research.md`: Google Form results recorded (6 real responses, names withheld) | Interviews not yet run; respondents are outside the team but are friends/contacts; limitations stated |
| 9 Nov | Task 2: cold-start and failure handling in the UI. "Waking the server, this can take up to a minute" banner while the HTTP layer retries; per-attempt 30 s timeout; friendly error + Retry on every screen (handovers, connect, ledger, conflicts, Gap Interview, Start here); skeletons and empty states for every list incl. versions; Reconstruct shows the job `error` as a warning when finished with partial failures. 7 new Playwright tests (6 screens fail then recover on Retry, 1 slow-server banner) pass | Tested with a **simulated** outage in mock mode (localStorage `continuum-mock-fail`), not by stopping the real Render API. Pawan's retry/back-off layer in `api.ts` was kept; I added only the banner hook and timeout. The job-`error` warning UI is not covered by a test yet |
| 9 Nov | Task 3: export. "Export as Markdown" and "Print / Save as PDF" on Start here (Successor and Lead) and on the ledger (Lead). Each claim carries its evidence state; citations are Markdown links where a URL exists (GitHub PR/commit) and `source name (label) — quote` otherwise; header has version, status, approver, publish time, and the line "Generated by Continuum; every claim cites its source." Built only from the role-scoped `/view` + `/evidence` responses (hidden items: count only); quotes overlapping a redaction are masked. Permission test extended: 17 → 34 checks pass (export has no lead-only text/fake key/fake phone); 2 new Playwright tests (download and print view) pass | Verified on the mock API; export against the live API not yet tried. The PDF is the browser's "Save as PDF" from a print-styled view, not a server-generated PDF. Mock-only oddity noticed: each approval bumps the handover version (v22 after approving everything) |
| 9 Nov | Task 4: "Review activity" page for leads (`/handovers/{id}/activity`, new tab): who did what and when, newest first, with action badges (text, not colour only), filters by action and person, the related claim's text, skeleton / empty / error+Retry states. Built on `GET /handovers/{id}/audit` (`api.getAudit`); the mock records the same action names as the API (approve, edit, reject, redact, mark_sensitive, resolve_conflict, answer_gap, publish, ack, flag_unclear). 3 new Playwright tests (history + new actions + filters; successor ack/flag shows up; Contributor is redirected away) pass; full e2e suite 14/14 | Verified on the mock only; the real `/audit` endpoint exists in `api/` but I have not run this page against the live API. Does not log who *viewed* the handover or exports (the API does not record those yet) |
| 9 Nov | Task 5: version diff. The ledger's Version history drawer now has "Compare two versions" (pick From and To, press Show changes): counts of added / removed / changed claims; edited text shown as a word-level before/after (removed words struck through, added words underlined, so not colour-only); rejections and field changes (evidence state, review status, sensitive, label, owner) listed as before → after. Built against `GET /handovers/{id}/versions/{a}/diff/{b}` (`api.getVersionDiff`; UI accepts `before`/`after` as text or partial claim) with a mock that stores a claim snapshot per version. 13 unit checks (`npm run test:unit`) and 3 new Playwright tests pass; full e2e 17/17 | The backend endpoint does not exist yet (checked `api/` and `docs/contracts.md`); against the live API the UI will show "Comparing these versions isn't available on this server yet" until Pawan adds it. The seeded v1/v2 snapshots are reconstructed from the seed (v1 = v3 minus the reviewer's three logged actions), not recorded history. Because every review action creates a version, the list can be long |
| 9 Nov | Live-site judge-style run (automated Chrome, fresh context, desktop + 375px emulation) and read-only permission checks on the live API; results in `docs/testing.md` | Found: bulk approval is far too slow on the live API (6–10 s per claim, 94 claims) so Publish is unreachable for a judge; "Project in five lines" empty; duplicate Render-vs-Vercel conflict. Permission checks passed (lead-only claims 403, no secrets in Contributor responses). Full path to Publish **not** completed on live. Real-phone test and handover test still not run |
| 9 Nov | Handover test recorded in `docs/testing.md`: 2 real people who did not know CampusKart, same 6 questions, both 6/6 against the answer key, one combined time reported (about 20 minutes) | No accuracy or speed difference can be claimed (both perfect; individual times not recorded); small sample, stated in the doc |
| 9 Nov | Task 9 documents: `docs/Continuum_Round2.pdf` (project document: architecture and data flow, tech and AI models, features built vs not, measured results, limitations, changes from Round 1, Round 3 commitments), `docs/Rahul_Manual_Testing_Report.pdf` (for Pawan: survey, handover test, live-site run, problems, suggested fixes, open items), `docs/demo-script.md` (3-min and 1-min), README (live links, Render notes, tests) | Facts taken from the repo docs and measured results only; the PDF states what is not built (file-upload UI on live, diff endpoint, real login, Guest role). HTML sources are in `docs/` so the PDFs can be re-rendered |
| 9 Nov | Tasks 6 and 7 (local only, committed but NOT pushed so the live site is not rebuilt): upload UI for Slack zip and notes with access label (matches Pawan's `/sources/upload`; removed the unused GitHub token field); shared accessible modal (focus trap, Esc, focus return) for the 3 dialogs; tap targets at least 36 px on phones; "needs attention first" ordering and "show all" for long ledger sections; export evidence fetched 6 at a time (was one by one, about 100 s for 91 claims; not re-timed on the live API). axe-core: 0 violations on 8 screens and 3 dialogs; 33 of 33 Playwright tests pass | Found and fixed by axe: Help button name did not contain its visible text. Not covered: dark mode (does not exist), screen reader, live upload endpoint. Waiting for Pawan's go-ahead to push `web/` (a push redeploys Render) |
| 9 Nov | Pushed tasks 6 and 7 to `main` at Rahul's request (6 commits, `bbaa05b`..`58aec65`); Render rebuilt the web in about 2 minutes. Read-only checks on the deployed site (`web/tests/live/deployed-check.spec.ts`): axe 0 violations on 8 screens with the real 94-claim data, evidence-drawer focus pass, Contributor export 35.0 s for 91 claims (was an estimated ~100 s). Found 22 px radio buttons on Conflicts at phone width; fixed (24 px, 40 px labels) | Upload form not tested on the live endpoint (the demo reset does not remove uploaded sources). Bulk approve still slow (Pawan) |
| 10 Nov | Re-tested the live site after Pawan's fixes (bulk approve, faster writes, project section, settled conflicts, diff endpoint): full path now reaches Publish, Successor, acknowledge and flag on desktop and phone emulation. Single approval 1.4 to 1.9 s (was 6 to 10 s); bulk approve about 2 s; export 15.7 s for 91 claims; axe 0 violations on 8 screens. Found that acknowledging in the UI took 16 to 26 s because 91 chip requests queued ahead of the click; fixed (writes jump the queue; chips load near the screen): evidence requests 91 to 14, acknowledge 3.0 s. Details and old numbers in `docs/testing.md` section 2b | Single samples on free hosting. Real-phone and 15-minute cold-start checks still to be done by Rahul. Local `npm run test:e2e` needs a webpack build on this PC (Application Control blocks the native compiler) |

## 14. Frontend guide (for teammates)
**Run it:** `cd web && npm install && npm run dev`, open http://localhost:3000. No keys needed; it runs on mock data.

**Where things are**
| Path | What |
|---|---|
| `web/lib/types.ts` | TypeScript version of the data contracts (HANDOFF section 6). Added one section key, `project` ("Project in five lines"), which the contract enum lacked. |
| `web/lib/api.ts` | One client interface. `NEXT_PUBLIC_USE_MOCKS=true` uses the mock; `false` calls the FastAPI at `NEXT_PUBLIC_API_URL`. |
| `web/lib/mock-api.ts`, `web/mocks/campuskart.ts` | Mock backend + synthetic CampusKart data. Applies the "claim visible only if the role may read ALL cited evidence" rule. |
| `web/lib/session.tsx` | Demo role entry (no sign-in). Replaced by Supabase Auth when keys exist. |
| `web/components/evidence.tsx` | Source chips and the evidence drawer (quote highlighted, redactions as blocks). |
| `web/app/handovers/[id]/...` | `connect`, `reconstruct`, `ledger`, `conflicts`, `interview`, `start` screens. |

**Judge walk-through (about 3 minutes):** Enter as Reviewer → open CampusKart → ledger: click a source chip → Conflicts: mark it or resolve it → switch to Leaver and answer a question → back as Reviewer: "Approve all Verified claims", approve the rest, Publish → switch to Successor: see the handover, note "N items hidden by your access level", acknowledge or flag a section.

**Known limitations (frontend):** mock data lives in the browser, so it is per-browser and "Reset demo" clears it. The successor view shows a draft preview before publish (labelled) so judges can explore without finishing review. File uploads in mock mode register a source but do not parse the file. Tokens typed into the GitHub field are never stored. Accessibility: badges use icon + text, controls are keyboard reachable; not yet audited with a screen reader.

## 15. Backend guide
**Run it:** `cd api`, create a venv, `pip install -r requirements.txt`, put keys in `api/.env` (never committed; names in `.env.example`), then `uvicorn app.main:app --port 8000`. Seed the demo with `POST /demo/seed`, then `POST /handovers/h_1/reconstruct` with header `X-Demo-Role: lead`. Tests: `pytest` (22 unit tests) and `python smoke.py` (live database).

| Path | What |
|---|---|
| `api/app/ingest.py` | Parses the Slack-format export and Markdown/PDF notes into evidence units; drops bots and noise; reports ok / partial / failed per source |
| `api/app/protect.py` | Finds secrets, emails and phone numbers and masks them before any model sees the text |
| `api/app/visibility.py` | Permission rule: a claim is visible only if the role may read ALL its cited evidence; lead-only evidence is filtered out before generation |
| `api/app/gemini.py`, `llm.py` | Model provider (batching, pacing, retry, on-disk cache, fallback across models when a free daily quota runs out) |
| `api/app/verify.py` | Citation checks: evidence id must exist, quote must fuzzy-match the source; only a "supports" verdict can make a claim Verified |
| `api/app/analysis.py` | Topic normalisation, duplicate merging (never across access labels), conflicts, gaps, readiness score |
| `api/app/pipeline.py`, `main.py`, `store.py` | The reconstruct pipeline, the API endpoints, and Supabase access |
| `supabase/migrations/0001_init.sql` | Tables and row-level security (applied to the Supabase project) |
| `docs/contracts.md` | Endpoint list and auth notes |

**Design points worth knowing:** lead-only evidence is processed in a **separate** model pass so its text can never be blended into claims that cite public evidence. Readiness only counts a required topic (deploy, payments, auth, email, storage) as filled when a decision/dependency/owner/fact whose own text is about that topic is Verified or Confirmed.

## 16. FAQ
**What is CampusKart?** The fake project the demo is about: a campus marketplace app built by a student club. We invented it so we can show Continuum without using anyone's real data. It has a chat export and notes (made by Rahul) and will have a public GitHub repo (made by Pawan) with commits, PRs and issues that hold known facts we planted (for example, "payments moved to UPI in PR #87", "README says Render but commits configure Vercel", "nobody owns the college SMTP account"). Because we planted the facts, we can measure how many Continuum finds.

**Why Gemini?** Continuum needs a language model to read messy chat and propose claims. Our Claude API key was not usable, and Gemini has a free tier. Free tier limits: about 20 requests per model per day. We stay under it by batching (about 25 calls for a full run), caching answers, and falling back to other models.

**Will judges hit the Gemini limit?** Only if the live site calls Gemini when they click. The plan: the demo handover shows a stored result, so viewing, reviewing, resolving, publishing and acknowledging never call the model. A fresh "Reconstruct" is the only action that does, and it should use the stored result for the demo data.
| 9 Nov | Pawan: fixes for the problems in Rahul's live test. `POST /handovers/{id}/claims/bulk` (approve pending claims, optionally only one evidence state; one request per 40 claims, one version, one audit row); single review actions run their database writes in parallel and keep the version number in memory (6 round trips down to 2); `GET /handovers/{id}/versions/{a}/diff/{b}` rebuilt from recorded review actions; "Project in five lines" picked by `pick_project_claims` (at most one Verified fact/decision/dependency per workstream, existing claims only); resolving a conflict also settles open conflicts that share a claim. Web ledger buttons call the bulk endpoint. | Measured locally against the real database: single action 0.6-1.3 s (was 6-10 s), bulk approve of all pending claims about 3 s. Not yet re-measured on Render; live end-to-end re-test pending. |
