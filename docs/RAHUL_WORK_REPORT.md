# Rahul's work report (for Pawan)

Team BINARY BUILDERS · Continuum · written 10 Nov 2026 · covers 8 to 10 Nov

Everything here is something that exists in the repo or was measured. Where something was **not done or not evidenced**, it says so. Detailed numbers and raw answers are in `docs/testing.md` and `docs/user-research.md`; this file is the map and the summary.

---

## 1. Status at a glance

| Area | State |
|---|---|
| Next.js web app, every screen (role entry, handovers, connect, reconstruct, ledger, evidence viewer, conflicts, Gap Interview, Successor "Start here", review activity, version compare, export) | **Built, deployed on Render, tested** |
| In-app guided tour, "Waking the server" banner, friendly errors, skeletons and empty states | **Built, deployed** |
| Markdown export and print/PDF of the handover, with citations | **Built, deployed** (15.7 s for 91 claims on 10 Nov) |
| Upload UI for Slack zip and notes (to Pawan's `/sources/upload`) | **Built, deployed. Not tested against the live endpoint** (the demo reset does not remove uploaded sources) |
| Accessibility pass (axe, focus, phone layout) | **Done; 0 violations on 8 live screens (10 Nov)**. No screen-reader audit; no dark mode |
| Demo data: CampusKart chat export (341 messages), notes, answer key | **Done** |
| User survey | **Done: 6 real responses** |
| Handover test (with vs without Continuum) | **Done: 2 real people, 6 of 6 each**, one combined time (about 20 min); no speed or accuracy difference can be claimed |
| Live-site judge-style test (desktop + phone emulation) | **Done twice** (9 Nov as found, 10 Nov after fixes); the full path to Publish, Successor, acknowledge and flag now passes |
| Real phone run (Android) | **Mostly done**: create, reconstruct, Successor view, acknowledge, Markdown export, **publish at 9:43 on 10 Nov** (API confirms). **Not evidenced: pressing "This is unclear" on the phone, and the 15-minute cold-start check** |
| Short interviews | **Not run** (optional; only the survey) |
| Round 2 project PDF, manual testing report PDF, demo script, README | **Done** |

---

## 2. What I built (web app, `web/`)

Stack: Next.js 15 (TypeScript, App Router), React 19, Tailwind CSS v4, lucide-react. My own components (shadcn/ui was dropped). No backend code was changed by me.

### Screens and features
| Feature | Where | Notes |
|---|---|---|
| One-click role entry (Reviewer, Successor, Leaver), no sign-in | `web/app/page.tsx`, `web/lib/session.tsx` | The role is sent to the API as `X-Demo-Role` |
| Handover list, create handover | `web/app/handovers/page.tsx` | |
| Connect sources: sample sources, GitHub URL, upload Slack zip / notes with an access label, per-source ok / partial / failed chips with reasons | `.../connect/page.tsx` | Repeat sources are refused (the same repo had been connected 6 times) |
| Reconstruct progress (5 stages) and job `error` shown as a warning | `.../reconstruct/page.tsx` | |
| Claim ledger: filters, evidence-state badges (icon + text), approve / edit / reject / mark sensitive / redact, readiness score with formula, publish gate with reasons, version history, "Approve all Verified", "Approve all remaining" | `.../ledger/page.tsx` | Needs-attention-first ordering; sections over 8 claims collapse |
| Evidence viewer: original text in context, quote highlighted, redactions as blocks | `web/components/evidence.tsx` | Chips load only when near the screen |
| Conflicts: side by side, resolve with a note or "mark unresolved, successor to follow up"; never auto-picks the newest | `.../conflicts/page.tsx` | |
| Gap Interview for the leaver | `.../interview/page.tsx` | Answers become Exit Q&A evidence |
| Successor "Start here": 7 sections, badges, source chips, "N items hidden by your access level" (count only), acknowledge / "This is unclear" | `.../start/page.tsx` | Buttons are disabled while a request runs |
| Review activity (audit log) with filters | `.../activity/page.tsx` | Built on `GET /handovers/{id}/audit` |
| Version compare (word-level before / after) | `web/components/version-diff.tsx`, `web/lib/diff.ts` | Works on the live API since Pawan's diff endpoint |
| Export as Markdown and Print / Save as PDF | `web/lib/export.ts`, `web/components/export.tsx` | Uses only what the viewer's role may see; masks quotes that overlap a redaction |
| Guided tour (8 steps) | `web/components/tour.tsx` | Dismissible, remembered, reopened from Help |
| "Waking the server" banner, friendly error with Retry on every screen, skeletons, empty states | `web/components/feedback.tsx`, `web/lib/status.ts` | Pawan's retry and back-off layer in `api.ts` was kept; I added the banner hook, a 30 s per-attempt timeout, and a priority lane so clicks never wait behind background reads |
| Accessible dialogs (focus trap, Esc, focus returns to the opener) | `web/components/modal.tsx` | |

### How the UI was built before the backend was live
`web/lib/api.ts` is one facade. With `NEXT_PUBLIC_USE_MOCKS=true` (the local default) it uses an in-browser mock (`web/lib/mock-api.ts`, fixture `web/mocks/campuskart.ts`) that enforces the same permission rule as the real system (a claim is visible only if the role may read all its cited evidence). With `false` (the Render deployment) it calls the real API. Data shapes: `web/lib/types.ts`, mirrored by `docs/contracts.md`.

### Demo data (`demo-data/`)
`generate_chat_export.py` (deterministic): a 341-message Slack-format export over 3 channels with Hinglish lines, bot messages, one-word replies, join/leave events and the planted facts; 4 notes files (one lead-only with a fake key and fake phone); `manifest.json` (access labels); `ANSWER_KEY.md` (what a perfect system finds). **Known weakness (mine):** the generated chat repeats filler sentences on several dates, so some claims show 3 to 5 identical citations.

---

## 3. Tests I wrote

| Suite | What it covers | Result |
|---|---|---|
| `npm run test:unit` (`permissions.test.ts`, `diff.test.ts`) | Contributor and Leaver views never contain lead-only text, key or phone; publish gate; export has no lead-only text and masks redacted quotes; version diff and word diff | 47 checks pass (34 + 13) |
| `npm run test:e2e` (Playwright, 8 files) | Fresh visitor completes tour to published to acknowledged; outage banner and Retry on 6 screens; Markdown download and print view; audit log; version compare; upload (ok, failed, partial); duplicate sources; axe on 8 screens and 3 dialogs; dialog focus; 375 px layout; tap sizes; single acknowledge | **37 of 37 pass** (local mock mode, 10 Nov) |
| `web/tests/live/judge-run.spec.ts` | Judge-style walkthrough of the **live** site, desktop and 375 px, ending with API permission checks as Contributor; resets the demo afterwards | Last run: no failed step, no notes |
| `web/tests/live/deployed-check.spec.ts` | Read-only checks of the live site: axe on 8 screens, phone layout and tap targets, drawer focus, export time | Last run: 0 violations, phone OK, export 15.7 s |

Run the live scripts with `npx playwright test -c playwright.live.config.ts`.
**Environment note:** on 10 Nov, Windows Application Control blocked Next's native compiler on my PC, so `npm run test:e2e` could not build with its usual command. I built with plain `next build` (WebAssembly fallback) and ran the same tests against it with a temporary config. This does not affect Render.

---

## 4. Human testing and research

### Survey (`docs/user-research.md`)
Google Form, 6 real responses (club leads 2, developers 3, someone who had handed over a project 1); respondents are outside the team. Most lost "why decisions were made" (4) and "who owns what" (4). Trust in a software-written handover averaged 3.7 of 5 (nobody chose 5). 5 of 6 would approve claims one by one "if it takes under 10 minutes". All 6 allowed anonymous quotes. Weak spot: demo-feedback answers were mostly one word.

### Handover test (`docs/testing.md` section 4)
Two real people who did not know CampusKart answered the same 6 questions: **6 of 6 each**; one combined time, about 20 minutes. Individual times were not recorded, so **no speed difference can be claimed**, and with both perfect, **no accuracy difference either**. It is an illustration, not proof.

### Real phone run (Android, 10 Nov; `docs/testing.md` section 5)
- 8:59 to 9:02: created a handover (Rahul to Pawan), reconstructed with the **live pipeline** (113 claims, 5 conflicts, 2 gap questions), viewed Start here, exported Markdown (43.19 KB).
- 9:19 to 9:20: Successor view and a Contributor export from the phone. Compared with the Lead export of the same handover: **110 claims against 113; the 3 missing claims are exactly the lead-only ones**; no key, phone number or mentor text in the Contributor file; "3 items were withheld by access level" shown; section 7 acknowledged.
- 9:43: **Published v9, locked** (screenshot). The API agrees: status published, 5 conflicts marked "unresolved, successor to follow up", readiness 80, the Contributor view has 110 claims, hidden count 3, evidence of the 3 lead-only claims returns **403**.
- **Not evidenced:** pressing "This is unclear" (no flag in the audit log) and the **15-minute cold-start check**. If either was done, add the result to `docs/testing.md` section 5.
- Found on this run and fixed: step tabs took three rows (now one scrollable row); the Reconstruct "finished" row was squeezed (now wraps); repeated sources (now refused); repeated taps logged one section acknowledged **5 times in 12 seconds** (buttons now disabled while a request runs; test added).

---

## 5. Live-site testing: before and after your fixes

**9 Nov, as found** (automated Chrome, fresh context, desktop 1280 px and 375 px emulation; full detail in `docs/testing.md` section 2): the path to Publish could not be completed because each approval took 6 to 10 s and the demo has 94 claims. I reported 8 problems with evidence (`docs/Rahul_Manual_Testing_Report.pdf`).

**10 Nov, after your fixes** (single samples on free hosting; full table in `docs/testing.md` section 2b):

| What | 9 Nov | 10 Nov |
|---|---|---|
| Approve one claim (API) | 9.8 s, 6.0 s, 7.7 s | 1.74 s, 1.87 s, 1.41 s |
| Approve all Verified (API / UI) | did not finish in 120 s | 1.88 s for 78 claims / 2.4 to 2.5 s |
| Approve all remaining (API / UI) | not reached | 2.26 s for 13 claims / 1.4 to 1.9 s |
| Acknowledge, click to visible badge (UI) | 18.4 s | 3.0 s (after my web fix; 16.5 to 26.3 s just before it) |
| Markdown export, 91 claims | about 100 s (estimate) | 15.7 s |
| Version diff | HTTP 404 | HTTP 200, 2.7 s |
| "Project in five lines" for the Successor | 0 claims | 5 claims |
| Accessibility (axe, 8 live screens) | not measured | 0 violations |

A problem found on my own side during the re-test: acknowledge took 16 to 26 s in the UI although the API call takes about 1.5 s, because 91 source-chip requests queued ahead of the click. Fixed: chips load only near the screen and writes jump the queue (evidence requests 91 down to 14).

---

## 6. Open items for you (Pawan)

From the live pipeline run on a fresh handover (details in `docs/testing.md` section 5):
1. **False payment conflicts.** 5 conflicts appeared; 3 are about payments ("card gateway module added" and "1 rupee test payment" shown as conflicting with the UPI decision). The key planted decision (PR #87) ends up marked Conflicting. A reviewer must defer or resolve all 5 to publish.
2. **"Project in five lines" is trivia** (dark mode toggle, API under 200 ms, posters printed) rather than what CampusKart is.
3. **Redundant gap question:** it asks who owns the image bucket although the chat names Meera.
4. **Repeated claims:** near-duplicate claims and repeated citations (partly caused by my generated chat repeating filler lines).
5. **Test handovers are visible in the live Handovers list.** Please clear them before submitting; judges would see them. (The demo handover `h_1` is reset and unpublished as of the last check.)
6. **The version counter inflates** (one per review action, e.g. "version 54"). Cosmetic.
7. **The duplicate Render-vs-Vercel conflict still shows as two cards** (resolving one settles both).
8. **Live upload endpoint:** my upload form is untested against it, because the demo reset does not remove uploaded sources. A test needs a separate handover you delete afterwards.
9. **Known limitation, already documented:** the role comes from a request header, not a verified login.

---

## 7. What is not done (honest list)
- Short interviews (only the survey was run).
- "This is unclear" and the 15-minute cold start on a real phone (not evidenced).
- The live upload endpoint test.
- Screen-reader audit; dark mode (the app is light only).
- Version-counter and README-date quirks were not re-checked after your fixes.
- Everything measured is single samples on free hosting, not averages.

---

## 8. Documents I produced
| File | What |
|---|---|
| `docs/Continuum_Round2.pdf` (+ `.html`) | Round 2 project document: architecture and data flow, technology and AI, features built vs not, measured results, limitations, changes from Round 1, Round 3 commitments |
| `docs/Rahul_Manual_Testing_Report.pdf` (+ `.html`) | Manual testing report for the team: survey, handover test, live runs, phone run, problems, suggested fixes |
| `docs/testing.md` | All test evidence with old and new numbers kept side by side |
| `docs/user-research.md` | Survey results, verbatim quotes, limits |
| `docs/demo-script.md` | 3-minute and 1-minute demo, honest answers to likely judge questions |
| `README.md` additions | Live links, Render notes, test commands, disclosure |
| `PROJECT_OVERVIEW.md` | Build log row for each step (section 13) and a frontend guide (section 14) |
| `docs/RAHUL_WORK_REPORT.md` | this file |

The PDFs are rendered from the HTML files with headless Chrome. To regenerate, edit the HTML and print it to PDF (A4, backgrounds on).

---

## 9. Commit map (all authored by RAHUL0408-B)
- **Scaffold, contracts, mock API, every screen, first tests:** `324a8f7`, `eb21334`, `39c9853`, `8ab4cbd`
- **Demo data:** `5a1bd61`
- **Tour:** `8dd9e3d` · **Failure handling:** `e2f094f` · **Export:** `2d064ac` · **Audit page:** `acd5627` · **Version compare:** `d668b7f`
- **Accessible dialogs, ordering, tap targets, parallel export, upload UI, tests, live script:** `bbaa05b`, `48efc38`, `5a7cafb`, `dc4805b`, `51c690d`, `58aec65`
- **After live checks (radios, deployed-site checks):** `158f1ee`, `5c3dca2`
- **After your fixes (request queue, lazy chips, judge test update, tap link):** `aec685d`, `99a9ff1`, `275e3e8`, `41de727`
- **After the phone run (tabs, duplicates, acknowledge guard):** `32ff4fb`, `7a238d2`, `61fb9fd`, `3a05e49`
- **Docs (research, testing evidence, PDFs, demo script, phone run):** `496822f`, `d3beddc`, `93a4b2f`, `61f1d4c`, `976fb51`, `b68f73b`, `e18eee2`, `b349bfc`, `8ae345b`, `29c06a0`, `bc870bc`, `9d434bf`, `ba0e255`, `8000500`, `59fb746`, `6f0e89a`, `6a1db91`

Note: four early docs commits (`61f1d4c`, `976fb51`, `b68f73b`, `e18eee2`) carry a "Co-Authored-By: Claude" trailer; the author is still RAHUL0408-B. Later commits do not.

---

## 10. AI use (disclosure)
I used Claude (Anthropic) via Claude Code to help plan, write and test the web app, the demo data generator and the documents. I reviewed the code and the numbers, supplied all human results (survey, handover test, phone run, screenshots), and can explain every part. This is also listed in `README.md`. Nothing in this report is an invented number: figures come from the survey form, from timed calls and runs on the live site, or from the API's own records, and they are marked as single samples where applicable.
