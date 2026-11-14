# Backend evaluation (measured, not estimated)

Run on 9 Nov 2026 against the synthetic CampusKart handover (`h_1`) with the live pipeline: evidence = Slack-format chat export
(324 usable messages after noise filtering), 4 notes files (one lead-only), and the CampusKart GitHub repo via the connector
(53 evidence units: README, commits, PRs and PR comments, open/discussed issues, TODO scan). Model: Gemini (free tier, model
chain with automatic fallback). Scorer: `api/evaluate.py` (strict keyword checks against `demo-data/ANSWER_KEY.md`).

| # | Planted fact | Result |
|---|---|---|
| 1 | UPI decision, PR #87, merchant KYC | **Partly found.** The decision is extracted, but as an *Inferred* claim citing the chat, not a Verified claim citing PR #87. Counted as a miss by the scorer. |
| 2 | README says Render, commits configure Vercel | **Found** as a Conflict with both sides shown. One extra conflict was also raised (Render vs "frontend tested on Vercel preview"), which is arguably a false positive; the reviewer resolves or dismisses it. |
| 3 | College SMTP account has no owner | Found (Gap Interview question). |
| 4 | PR #91 temporary fix, TODO in auth/session.ts | Found (state: Inferred). |
| 5 | Image bucket credential held by Meera | Found (state: Inferred in the last run; Verified in an earlier run). |
| 6 | "build fails on Windows path" raised 3 times | Found, but with 2 of the 3 expected citations in one claim. |
| 7 | COD open question | Found. |
| 8 | PR #94 open, changes requested | Found (Verified). |
| 9 | Lead-only note never in the Contributor view; key and phone masked | Pass (no lead-only text in Contributor claims or API responses; secret and phone masked even for the lead). |
| 10 | Bot / one-word / join-leave noise filtered | Pass. |

**Items 1-8 found: 7 of 8** by the strict scorer (item 1 is the miss). **Claims with a valid citation: 94 of 94** (claims with no surviving citation
are dropped or labelled Inferred). States in the last run: 80 Verified, 10 Inferred, 4 Conflicting (2 conflicts), 1 Missing topic.

## Honest caveats
- LLM output varies between runs: earlier runs of the same data scored 6/8 and 8/8-ish on different prompts; results here are one run, not an average.
- Free-tier model quotas (about 20 requests per model per day) forced batching and a model fallback chain; later models in the chain may be weaker.
- The scorer uses keywords, so it can both over- and under-count.
- Permission checks tested against the live database through the API (`api/smoke.py`); the database's row-level-security policies exist but the demo relies on the API's role checks.
- Not yet measured: precision of conflicts beyond this dataset, behaviour on other repos, load.

---

## Round 3 measurements (14 Nov 2026, measured, not estimated)

Same synthetic CampusKart data plus one new planted notes file (`notes/vendor-payments-2026-10-12.md`: fake UPI ID, PAN and
Aadhaar, a remark judging a teammate, and a prompt-injection line). Scorer: `api/evaluate.py` (strict keyword checks).
Both runs use the in-memory store and the GitHub snapshot fixture, so they are reproducible without a database.

| Run | Command | Items 1-8 | Round 3 checks (11, 11b, 12, 13) | Claims with a valid citation | Conflicts |
|---|---|---|---|---|---|
| **Rules mode (no AI at all)** | `CONTINUUM_GITHUB=snapshot python evaluate.py --offline-rules` | **8/8** | **4/4** | 29/29 | 1 (Render vs Vercel, kind "out of date") |
| **AI mode (Gemini, rules fallback)** | `CONTINUUM_GITHUB=snapshot python evaluate.py --offline-ai` | **8/8** | **4/4** | 114/114 | 1 (Render vs Vercel, kind "out of date") |

What changed since Round 2 (7/8, 2 conflicts of which one false):
- Item 1 (UPI decision citing PR #87) is now found as **Verified** in both modes (Round 2: Inferred, scored as a miss).
- Conflicts are decided by named values and clustered: the Render-vs-Vercel disagreement is one conflict with all its sides;
  "frontend tested on Vercel preview" and past-tense statements no longer raise false conflicts.
- Item 6 (Windows build) now cites all 3 occurrences (Round 2: 2 of 3).
- The AI run used 28 model calls and needed no fallback; rules mode made no model calls.

Honest caveats:
- One run each, on one synthetic dataset we wrote ourselves; the rules were tuned on this data, so rules-mode recall on
  other projects will be lower. Rules mode produces far fewer claims (29 vs 114): it is a reliability fallback, not a
  replacement for the model.
- In AI mode the model also turned the planted remark about a teammate into a contributor-visible risk claim. The privacy
  gate blocks publishing until a reviewer decides on it (tested), which is the intended safety net, not a model success.
- The live demo still replays the Round 2 stored run (94 claims), re-checked with the Round 3 conflict rules.
