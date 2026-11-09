# Testing evidence

Only real results are recorded here. Anything not yet done says **not yet run**. Dates are 2026.

## 1. Automated tests in the repo (mock mode, local)
Run from `web/`. These test the UI and the in-browser mock API, **not** the live backend.

| Suite | What it checks | Result (9 Nov) |
|---|---|---|
| `npm run test:unit` → `tests/permissions.test.ts` | Contributor/Leaver view and evidence never contain lead-only text, the fake key or the fake phone; publish is blocked until conflicts and claims are handled; export (Markdown/print model) has no lead-only text and masks redacted quotes | 34 checks pass |
| `npm run test:unit` → `tests/diff.test.ts` | Version diff and word-level text diff | 13 checks pass |
| `npm run test:e2e` (Playwright, system Chrome, 17 tests) | Fresh visitor completes tour → publish → acknowledge; outage banner and Retry on 6 screens; Markdown download and print view; audit log; version compare | 17 of 17 pass |

## 2. Judge-style run on the LIVE site (automated)
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

## 3. Permission checks on the LIVE API (read-only, 9 Nov)
Direct calls with header `X-Demo-Role`:
- Contributor and Leaver responses from `/view`, `/claims`, `/sources`, `/conflicts`, `/gaps` contained none of: the fake key, the fake phone, the mentor's candid feedback.
- The lead-only mentor-notes source is not listed for Contributor/Leaver; the Lead sees it.
- All 3 lead-only claims returned HTTP **403** for `/claims/{id}/evidence` as Contributor and as Leaver.
- As Lead, the evidence for those claims did not contain the raw key or phone (masked).
- Note: the Contributor view does contain claim `cl_105`, "Prof. Iyer has shared mentor notes on a shared sheet for the lead." It comes from a public chat message, not from the confidential note, so it is not a leak. It does reveal that mentor notes exist.
- Limit: the role is taken from a request header, not a verified login (see `docs/contracts.md`). Anyone who sets the header can act as Lead. This is a known limitation of the demo.

## 4. Handover test (with vs without Continuum)
**Not yet run.** Needs two real people who do not know CampusKart. Planned: Person A gets only the repo and chat export, Person B gets only the live site as Successor; same 6 questions; time and correctness checked against `demo-data/ANSWER_KEY.md`.

| | Person A (without Continuum) | Person B (with Continuum) |
|---|---|---|
| Time taken | not yet run | not yet run |
| Correct answers (of 6) | not yet run | not yet run |
| Notes | not yet run | not yet run |

Two people is a very small sample; any result will be reported as an illustration, not proof.

## 5. Real phone and 15-minute cold-start check
**Not yet run** (needs a person with a real phone). Emulated phone-width results are in section 2.

## 6. User research
See `docs/user-research.md` (6 survey responses recorded; interviews optional, not yet run).

## 7. Known limitations (so far)
- Role comes from a header, not a verified login.
- Live approvals and other writes are slow (section 2, problem 1).
- Tests in sections 1 and 2 are automated; real-device and real-user testing is still open.
- Accessibility: partly checked (badges use text, keyboard focus visible), no screen-reader audit yet; Esc/focus trap not verified on every drawer.
