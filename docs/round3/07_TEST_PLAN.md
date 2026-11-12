# 07 — Round 3 test plan (Reliability is 20 points; testing notes are required in the submission)

Record **real** results only, with date and environment. Never estimate.

## 1. Automated
| Suite | Where | New in Round 3 |
|---|---|---|
| API unit (pytest) | `api/tests/` | rules extractor rows (positive+negative), injection guard, date fixes, clustering, resolve actions, snapshot hash stability, diff, tasks, ack carry-over, detectors incl. Verhoeff, audit chain verify + tamper, guest permissions |
| **Leak canary** | `api/tests/test_leak_canary.py` + live script | For roles contributor, leaver, guest: call **every GET endpoint** (view, claims, evidence, conflicts, gaps, versions, diff, tasks, audit, export, ask) and assert none of the canary strings appear: mentor-note phrases, `sk_test_FAKE_51abcDEF0123456789`, `+91-00000-00000`, planted PAN/Aadhaar/UPI/JWT. Also assert hidden ids return 404. |
| Web unit | `web/tests/*.test.ts` | diff rendering, ack carry-over display, permission helpers for guest |
| E2E mock (Playwright) | `web/tests/e2e/` | conflicts keep/both/correct/defer; full task loop; versions + diff; privacy queue; guest; view-as; audit verify; axe on every new screen; 375 px run |
| E2E live | `web/tests/real-e2e.mjs` | extend with the 6-step judge path; reset at end |
| Planted facts | `api/evaluate.py` | run in **model** mode and **rules** mode; add new items: injection line not Verified; PAN/Aadhaar masked; staleness conflict kind |
| CI | GitHub Actions | pytest + typecheck + unit + e2e(mock) on every push |

## 2. Failure cases (write each result in docs/testing.md)
| Case | Expected |
|---|---|
| Gemini key missing / quota exhausted | reconstruct completes in rules mode; banner says so |
| Gemini returns invalid JSON / 503 | retry, then rules for that batch; job error lists batches |
| Private or missing GitHub repo | source "failed" with reason; others continue |
| Malformed Slack zip, zip with `../` path | failed source with reason; nothing extracted outside temp |
| Empty notes / scanned PDF without text | failed "No readable text" |
| Double-click publish / ack / resolve | idempotent; one audit row |
| Edit after publish | successor still sees published snapshot |
| Ack on draft, ack as lead | 400 / 403 |
| Exit answer with a key | 400 with friendly message |
| Render cold start | "Waking the server" banner; first load timed and recorded |
| Supabase unreachable | API 503 with clear message; UI LoadError with retry |
| Two reviewers resolve the same conflict | second gets 409 "already settled by X" |

## 3. Manual / human (Rahul)
- Phone run of the full judge path (record device, browser, result, screenshots).
- Cold-start timing from a sleeping instance (3 samples, report each, not an average of guesses).
- **Usability sessions:** 3–5 real people (club leads / students) do the judge path unaided; record time, where they got
  stuck, quotes. Real names only with permission; otherwise "Participant 1". This is the strongest evidence for
  "Usability and real-world fit" (20 pts).
- Accessibility: keyboard-only pass of the judge path; screen-reader spot check (NVDA) on Start here and Conflicts.

## 4. Reporting format (docs/testing.md, new "Round 3" section)
For each item: what was run, when, where (mock/live), result (pass/fail + numbers), evidence link (log, screenshot),
and known failures left open. Keep failed results visible.
