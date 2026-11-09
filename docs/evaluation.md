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
