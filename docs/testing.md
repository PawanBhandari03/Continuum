# Testing evidence

Only real results are recorded here. Anything not yet done says **not yet run**. Dates are 2026.

## 1. Automated tests in the repo (mock mode, local)
Run from `web/`. These test the UI and the in-browser mock API, **not** the live backend.

| Suite | What it checks | Result (9 Nov) |
|---|---|---|
| `npm run test:unit` → `tests/permissions.test.ts` | Contributor/Leaver view and evidence never contain lead-only text, the fake key or the fake phone; publish is blocked until conflicts and claims are handled; export (Markdown/print model) has no lead-only text and masks redacted quotes | 34 checks pass |
| `npm run test:unit` → `tests/diff.test.ts` | Version diff and word-level text diff | 13 checks pass |
| `npm run test:e2e` (Playwright, system Chrome, 33 tests, local mock mode) | Fresh visitor completes tour → publish → acknowledge; outage banner and Retry on 6 screens; Markdown download and print view; audit log; version compare; file upload (ok, failed and partial sources, access label); axe accessibility scan; dialog focus; 375 px layout | 33 of 33 pass |

## 1b. Accessibility and phone-width pass (9 Nov, local build, mock mode; deployed 9 Nov in commit 58aec65)
Automated with axe-core (WCAG 2.0/2.1 A and AA rules) in Chrome, plus focus and layout checks.

| Check | Result |
|---|---|
| axe on 8 screens (landing, handovers, connect, ledger, conflicts, activity, Gap Interview, Start here) in the light theme | **0 violations** after one fix |
| axe on the evidence drawer, version history and edit dialog | **0 violations** |
| Found and fixed | The Help button's accessible name did not contain its visible text ("Help"), which breaks WCAG 2.5.3 (label in name) |
| Dialogs (evidence viewer, version history, edit claim) | Focus moves in on open, Tab stays inside, Esc closes only that dialog, focus returns to the opener: pass |
| 375 px wide (phone emulation), all 8 screens | No horizontal scroll: pass |
| Tap targets on a phone-width ledger | Every button, link and field is at least 36 px high after the fix (before: tab links 32 px, "Handovers" link 28 px, one inline link 16 px) |

**Not done or not covered:** dark mode does not exist (the app is light only, so there is no dark-mode contrast to check); no screen-reader (NVDA/VoiceOver) audit; automated checks catch only part of the problems; colour contrast was checked by axe only on the screens above, with the demo data. These changes were pushed to `main` on 9 Nov at Rahul's request (Render rebuilt the site in about 2 minutes); see 1d for the checks on the deployed site.

## 1c. Upload sources UI (9 Nov; deployed 9 Nov in commit 58aec65)
The Connect screen now uploads a Slack export (.zip) or notes (.md, .txt, .pdf) to `POST /handovers/{id}/sources/upload` (multipart: `type`, `file`, `label`), with an access label choice. The previous version sent files as JSON, which the live API turns into a failed "not wired" source, and it showed a GitHub token field that was never sent to the server; both are fixed (token field removed; the text now says public repositories only). Tested in mock mode only (4 Playwright tests: readable notes, label stored, failures shown with a reason, bad GitHub URL). **Not tested against the live upload endpoint:** the demo reset does not remove uploaded sources, so a test upload would stay in the judges' demo handover. Needs Pawan's decision (for example a separate test handover that is deleted afterwards).

## 1d. Read-only checks on the DEPLOYED site (9 Nov, after the new build went live)
Script: `web/tests/live/deployed-check.spec.ts` (Chrome, real demo data with 94 claims; no approvals, uploads or resets).

| Check | Result |
|---|---|
| axe (WCAG 2.0/2.1 A and AA) on 8 screens | **0 violations on all 8.** The Conflicts page timed out once while loading (no content within 2 minutes) and loaded in 4 s on the re-run; one slow load, not reproduced. |
| Evidence drawer: Tab stays inside, Esc closes, focus returns to the source chip | Pass |
| Export as Markdown, Contributor, 91 claims | **35.0 s** (one run). Before the change the estimate was about 100 s (91 × 1.1 s). The file contained no lead-only text, fake key or fake phone. |
| 375 px phone emulation: horizontal scroll on 8 screens | None |
| 375 px phone emulation: controls under 36 px | Found: radio buttons on the Conflicts page were 22 px. Fixed (24 px radios inside 40 px tall labels) and pushed; re-check after that deploy is recorded in the build log. |

## 2. Judge-style run on the LIVE site (automated), 9 Nov: as found, before Pawan's fixes (re-test results are in 2b)
**What this is:** an automated Chrome run against https://continuum-web-kodb.onrender.com in a fresh browser context (no stored sign-in, equivalent to incognito), on 9 Nov. Desktop 1280×800, then a 375×812 touch viewport. **The "phone" run is Chrome emulation, not a real phone.** Script: `web/tests/live/judge-run.spec.ts`. The shared demo handover was reset afterwards through the API's demo reset.

**Worked on the live site**
- Home page loaded in about 2 s (the API had just been woken; its first call took 22 s). First-time tour appeared and closed.
- Enter as Reviewer → handover list → claim ledger (ledger loaded in 6–8 s).
- Source chip opened the evidence drawer with the cited quote highlighted; Esc closed it.
- Leaver: Gap Interview question answered and saved as Exit Q&A.
- Successor "Start here": "3 items hidden by your access level" shown (count only); every claim card had a state badge and at least one source chip; acknowledge and "this is unclear" both worked.
- Publish button correctly stayed disabled and listed why ("2 conflicts unresolved", "94 claims not reviewed yet").

**Did NOT complete: the full path to "published".** Resolving the conflicts and bulk approval were not finished, so Publish was never reached on the live site. The conflict step failed because of a bug in my test script (the live data has 2 conflicts, the script expected 1). The bulk-approve step did not finish within the 2-minute wait; see problem 1.

### Problems found (for Pawan unless marked mine)
| # | Severity | Problem | Evidence |
|---|---|---|---|
| 1 | **Blocker for judges** | Approving claims on the live API is very slow: 3 timed single approvals took 9.8 s, 6.0 s and 7.7 s; listing the 81 pending Verified claims took 6.6 s. Approving 81 (or all 94) claims one by one would take 8–15 minutes, so a judge cannot reach Publish. Needs a single bulk-approve endpoint (e.g. approve all pending Verified in one request) and/or faster writes. | Timed with direct API calls; screenshot `desktop-11` |
| 2 | High | "Project in five lines" is empty on the live data (0 claims in section `project`), so a Successor sees "Nothing visible to your role in this section" as the first thing. The pipeline does not output the `project` section. | `/handovers/h_1/view`: project 0, state 29, decision_log 11, first_week 20, risks 18, dependencies 3, unresolved 10; screenshot `phone-13` |
| 3 | Medium | The same disagreement (Render vs Vercel) appears as 2 separate conflicts (cf_1, cf_2), so a judge must resolve it twice. Also the README claim shows the date "9 Nov 2026" (ingest date), not the README's real date. | screenshot `desktop-08` |
| 4 | Low | Actions are slow even when single: acknowledge took 18 s (desktop) and 12 s (phone emulation); answering a gap took 10–22 s. | run log |
| 5 | Low | The version counter inflates (one per review action; "version 46" after about 45 approvals). Cosmetic but looks odd. | screenshot `phone-13` |
| 6 | Mine (frontend) | On a phone-width screen some controls are smaller than 28 px (logo link, "How is this calculated?", "resolve", "interview", source chips). No horizontal scrolling was detected on landing, ledger, evidence drawer or Start here. | run log |
| 7 | Mine (frontend) | Live data has 94 claims in one long list; the ledger has no paging or "needs attention first" ordering. | observed |

## 2b. Re-test on 10 Nov after Pawan's fixes (measured on the live site; 9 Nov numbers kept for comparison)
Pawan pushed a bulk-approve endpoint, faster writes, the project section, settled duplicate conflicts and the version-diff endpoint (commit `cddcdfd`). I then fixed two slow spots on the web side (commits `aec685d`, `99a9ff1`). All numbers below are **single samples on free hosting**, not averages. "UI" means click to visible confirmation in Chrome (includes reloading the screen); "API" means a direct call.

| What | 9 Nov (before) | 10 Nov (after) |
|---|---|---|
| Approve one claim (API, 3 samples) | 9.8 s, 6.0 s, 7.7 s | 1.74 s, 1.87 s, 1.41 s |
| List pending claims (API) | 6.6 s (81 rows) | 0.8 s (94 rows) |
| "Approve all Verified" | did not finish in 120 s (estimated 8 to 15 min one by one) | API 1.88 s (78 claims); UI 2.4 to 2.5 s in the final run (earlier runs on 10 Nov before my web fix: 5.5 to 7.7 s) |
| "Approve all remaining" | not reached | API 2.26 s (13 claims); UI 1.4 to 1.9 s |
| Mark a conflict unresolved (API) | not measured | 2.98 s; both duplicate conflicts changed together |
| Acknowledge, API call alone | not measured | 1.35 s |
| Acknowledge, click to visible badge (UI) | 18.4 s desktop, 12.4 s phone emulation (9 Nov); 16.5 s and 26.3 s (10 Nov, before the web fix) | 3.0 s desktop, 3.1 s phone emulation (final run); one separate probe 5.1 s |
| Flag "unclear" (UI) | 3.1 s, 3.3 s | 4.2 s desktop, 3.2 s phone emulation |
| Evidence requests fired when opening Start here | 91 | 14 (chips load only when near the screen) |
| Markdown export, Contributor, 91 claims | about 100 s estimated (one by one) | 35.0 s (9 Nov, parallel) then **15.7 s** (10 Nov, after the web and API fixes), one run each |
| Audit log (API) | 35.4 s once | 1.1 s (9 rows) |
| Version diff v1 to v2 (API) | HTTP 404 | HTTP 200 in 2.7 s |
| Demo reset (API) | 11.4 s | 6.7 s to 11.4 s |
| "Project in five lines" for the Successor | 0 claims | 5 claims |
| Duplicate Render-vs-Vercel conflict | 2 conflicts, each resolved separately | 2 conflict cards, resolving one settles both |

**Judge-style run, 10 Nov (final run, after the web fix):** the full path now reaches **Publish and then the Successor view, acknowledge and flag**, on desktop (1280 px) and on 375 px phone emulation, with no failed step and no notes; the API permission check as Contributor passed again (3 lead-only claims return 403). The demo was reset to 94 claims afterwards.

**Deployed-site checks, 10 Nov:** axe found 0 violations on all 8 screens (the Conflicts page, which timed out once on 9 Nov, loaded normally). The earlier 22 px radio buttons on Conflicts are fixed. One new finding: the "Open as Reviewer (Lead)" link on the Handovers list was 32 px high at phone width; fixed in a later commit (see the build log).

| 9 Nov problem | Status on 10 Nov |
|---|---|
| 1. Approvals too slow to reach Publish | **Fixed** (single approval about 1.4 to 1.9 s; bulk about 2 s) |
| 2. "Project in five lines" empty | **Fixed** (5 claims) |
| 3. Duplicate conflict | **Settled together** (two cards still appear; the README date quirk was not re-checked) |
| 4. Slow writes | **Much better** (1.3 to 2.3 s per write call); acknowledge in the UI was slowed by my own chip requests, fixed |
| 5. Version counter inflates; diff returns 404 | Diff **fixed**; version counter not re-checked |
| 6. Small tap targets | Fixed except the 32 px link above (fixed afterwards, needs a re-check) |
| 7. Export slow | **Improved** (about 100 s est. to 15.7 s) |
| 8. 94 claims in one long list | Attention-first ordering and "show all" are deployed |

**Environment note:** on 10 Nov Windows Application Control blocked Next's native compiler on Rahul's PC, so `npm run test:e2e` could not build with its usual command. I built with plain `next build` (WebAssembly fallback) and ran the same 33 tests against it with a temporary config: 33 of 33 passed. Render builds are not affected.

**Not done:** the real-phone run and the 15-minute cold-start check by hand (Rahul); the live upload endpoint (see 1c).

## 3. Permission checks on the LIVE API (read-only, 9 Nov)
Direct calls with header `X-Demo-Role`:
- Contributor and Leaver responses from `/view`, `/claims`, `/sources`, `/conflicts`, `/gaps` contained none of: the fake key, the fake phone, the mentor's candid feedback.
- The lead-only mentor-notes source is not listed for Contributor/Leaver; the Lead sees it.
- All 3 lead-only claims returned HTTP **403** for `/claims/{id}/evidence` as Contributor and as Leaver.
- As Lead, the evidence for those claims did not contain the raw key or phone (masked).
- Note: the Contributor view does contain claim `cl_105`, "Prof. Iyer has shared mentor notes on a shared sheet for the lead." It comes from a public chat message, not from the confidential note, so it is not a leak. It does reveal that mentor notes exist.
- Limit: the role is taken from a request header, not a verified login (see `docs/contracts.md`). Anyone who sets the header can act as Lead. This is a known limitation of the demo.

## 4. Handover test (with vs without Continuum)
Run on 9 Nov by Rahul with two real people who did not know the CampusKart project (names withheld). Both answered the same 6 questions; answers were checked against `demo-data/ANSWER_KEY.md`.

| | Person A (without Continuum) | Person B (with Continuum) |
|---|---|---|
| Material given | Repo + chat export only (as reported) | Live site as Successor (as reported) |
| Time taken | about 20 minutes (see note) | about 20 minutes (see note) |
| Correct answers (of 6) | **6 of 6** | **6 of 6** |

Per-question marking (both people): UPI decision and reason, image-bucket credential holder (Meera), deployment unclear (Render vs Vercel), PR #94 status, SMTP account owner unknown, login-fix risk, all matched the answer key.

**Notes and limits (stated honestly)**
- Only **one time figure ("about 20 minutes") was reported**. Rahul did not record separate times per person, so **no speed difference can be claimed**.
- Both scored 6 of 6, so this test shows **no accuracy difference** between the two conditions. It does not demonstrate that Continuum helps; the repo and chat export are small enough for a careful reader to answer these six questions.
- Person B's answers also used Continuum's labels (Verified, Conflicting, Missing, "AI inference") and named the Gap Interview for the SMTP question; Person A's answers did not carry such labels. That is a difference in how the answers were expressed, not in correctness.
- The assignment of the two answer sets to Person A / Person B follows Rahul's message; the exact materials each used are as reported, not independently observed.
- Two people is a very small sample. This is an illustration, not proof.
- Not yet done: a repeat with separate timers per person, or with a harder question set (for example questions that need the evidence viewer or the access rules).

### Appendix: answers as received (verbatim, lightly trimmed)
**Person A**
1. Payments moved from the card gateway to UPI deep links because the gateway required merchant KYC, which the student club could not obtain (PR #87).
2. Meera holds the third-party image-bucket credential.
3. It is unclear: the README says Render, while later commits configure Vercel. Neither source establishes the current authoritative deployment.
4. PR #94 (seller dashboard) is still open. Changes were requested on 19 October (empty state and price validation) and it has been inactive for about three weeks.
5. No one is identified as the owner of the college SMTP account. Meera explicitly says she does not have its password and does not know who set it up.
6. PR #91's login-loop "fix" clears the session cookie on redirect. It is explicitly a temporary hack, with a TODO to replace it after refresh-token rotation is implemented; it may be fragile and regress.

**Person B**
1. The card payment gateway asked for merchant KYC and the team couldn't get a merchant account, so the app couldn't go live. In #payments on 12 Aug the gateway KYC problem was raised and the reply was that the payment PR was merged and "UPI hi chalega abhi". PR #87 (14 Aug) replaced the card gateway with UPI deep links. State: Verified.
2. Meera (Meera Nair) alone. In #dev on 25 Aug she said listing images go to a third-party bucket and only she has the credential. Anyone who needs it has to ask her (single point of failure). State: Verified.
3. No, it isn't clear; the system should show a conflict. The README says Render; a commit on 2 Oct added vercel.json and moved the frontend to a Vercel preview; on 6 Oct someone asked in #general whether anyone would update the README. The system shouldn't pick the newer source; both sides should be shown for a human to decide. State: Conflicting.
4. The seller dashboard PR: opened 18 Oct, changes requested 19 Oct (empty-state handling and price validation); the 20 Oct meeting notes say it needs another review pass. Still open and stale for about three weeks, so it should be the successor's next action. State: Verified.
5. Nobody knows. Verification emails go out through it. In #dev on 2 Sep one person said they don't have the password and don't know who set it up; another said it already existed and the team just used it. It should appear as Missing and become a Gap Interview question for the leaver (Aditi); it shouldn't be guessed.
6. PR #91 is a temporary fix for the login loop: it clears the session cookie on redirect and the proper fix was deferred; a TODO sits in auth/session.ts. Nothing in the sources says it is unsafe, so it is an AI inference and is labelled "AI inference, not stated in any source". It could hide the real cause or log users out unexpectedly. State: Inferred.

## 5. Real phone and 15-minute cold-start check
**Not yet run** (needs a person with a real phone). Emulated phone-width results are in section 2.

## 6. User research
See `docs/user-research.md` (6 survey responses recorded; interviews optional, not yet run).

## 7. Known limitations (so far)
- Role comes from a header, not a verified login.
- Writes were slow on 9 Nov (6 to 10 s) and were measured at about 1.3 to 2.3 s on 10 Nov (single samples, section 2b); free-tier hosting can still be slower after idle (the API took 33 s to answer its first health check after a long idle on 10 Nov).
- Tests in sections 1 and 2 are automated; real-device and real-user testing is still open.
- Accessibility: automated axe checks pass locally and on the deployed site (sections 1b and 1d); no screen-reader audit; no dark mode.
