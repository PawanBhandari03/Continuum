# Round 2 submission draft (Pawan files this; only the team leader submits)

Fill the placeholders marked **[TODO]** with real results before submitting. Test every link in an incognito window.

## Links
- Working project (no sign-in needed; click "Enter as Reviewer"): https://continuum-web-kodb.onrender.com
  - Free hosting sleeps when idle; the first load can take about a minute.
- API: https://continuum-api-945j.onrender.com (health check: /health)
- Source repository: https://github.com/PawanBhandari03/Continuum
- Synthetic demo project the product reads: https://github.com/PawanBhandari03/campuskart (fictional; see its NOTICE.md; commit dates are simulated)
- Updated project PDF: **[TODO: docs/Continuum_Round2.pdf from Rahul's Claude, then a Drive link with "anyone with the link"]**

## What Continuum is (one paragraph)
Continuum rebuilds a project's current state from its repo, team chat, notes and issues and produces a handover where every statement
cites its source and carries an evidence state (Verified, Inferred, Conflicting, Missing, Confirmed). The leaver answers only the questions the
evidence cannot answer; a reviewer approves exactly what the successor may see; the successor acknowledges each section or flags it unclear.

## Features completed (Round 2)
1. **Connect:** GitHub repo (README, commits, PRs and comments, issues, TODO/FIXME scan), Slack-format chat export upload (.zip), notes upload (.md/.txt/.pdf); per-source status (ok / partial / failed with a reason).
2. **Protect:** secrets, emails and phone numbers are detected and masked before any model sees the text; every evidence unit carries an access label (public / contributor / lead_only).
3. **Reconstruct:** AI extracts atomic claims (decision, risk, dependency, owner, next action, open question, fact) that must cite evidence ids with an exact quote; lead-only evidence is processed in a separate pass so it can never leak into other claims.
4. **Verify:** evidence id and quote are checked by code (fuzzy match); a second narrow model check decides "supports / partially / does not"; only "supports" can be Verified; unsupported claims are dropped or labelled "AI inference, not stated in any source".
5. **Conflicts and gaps:** contradictory claims are shown side by side and never auto-resolved; missing required topics (deploy, payments, auth, email, storage) become Gap Interview questions; a readiness score with a visible formula.
6. **Review:** approve, edit, reject, mark sensitive, redact; version history; publish is blocked until conflicts are resolved or marked "unresolved, successor to follow up" and claims are reviewed; publishing locks the version.
7. **Gap Interview:** the leaver's answers become new citable evidence ("Exit Q&A").
8. **Handover:** role-scoped successor view ("Start here", seven sections), source chips that open the original text in context, "N items hidden by your access level" (count only), acknowledge or flag unclear per section.
9. **Audit trail** of review actions; a guided first-run tour for judges.

## Technology and implementation
- **Frontend:** Next.js 15 (TypeScript, App Router), Tailwind CSS v4, lucide-react icons; Playwright tests.
- **Backend:** Python 3.11, FastAPI, Pydantic, httpx, rapidfuzz (quote matching), pypdf; deterministic pipeline (no agent framework).
- **Database:** PostgreSQL on Supabase with row-level-security policies (migration `supabase/migrations/0001_init.sql`).
- **AI:** Google Gemini API (structured JSON output) behind a swappable provider interface, with batching, request pacing, retry, response cache and a fallback chain across models when a free-tier daily quota runs out.
- **Hosting:** Render (API and web), Supabase (database).
- **Tests:** 26 unit tests (`api/tests`), a live API smoke test (`api/smoke.py`), a planted-facts scorer (`api/evaluate.py`, results in `docs/evaluation.md`), a real-browser end-to-end test against the deployed site (`web/tests/real-e2e.mjs`).
- **Measured results (one run, not an average):** 7 of 8 planted facts found; 94 of 94 shown claims carry a citation; lead-only note, its fake key and fake phone never appear in the Contributor view.
- **AI use disclosure:** Claude (Anthropic) via Claude Code assisted with planning and code; the team reviews and can explain the code. Details in README.md.

## Changes from the Round 1 plan (honest)
| Plan | What happened | Why |
|---|---|---|
| Claude API for extraction | Gemini API behind a swappable interface | No usable Claude API credit; Gemini has a free tier |
| shadcn/ui | Own Tailwind components | Saved setup time |
| Local embeddings (multilingual-e5) | Skipped; topic keys, fuzzy matching and a model contradiction check instead | Memory limits on free hosting; time |
| Supabase Auth login | One-click demo roles (role sent with each request) | Judges must use the link without signing in; real auth is a later hardening step |
| Vercel for web | Render for web and API | One place, existing account |
| Python worker + jobs table | Background thread in the API plus a jobs table | Simpler on free hosting |
| Trello CSV, DOCX | Not built | Cut list from the plan |
| Live reconstruction of the demo | Demo handover replays a stored real run | Gemini free tier allows about 20 requests per model per day; new handovers run the live pipeline |

## Known limitations (we state them on purpose)
- The role is chosen in the UI and sent in a header; it is not a verified login. Row-level-security policies exist in the database but the demo relies on the API's role checks.
- Model output varies between runs; the PR #87 decision is extracted as an AI inference, not a Verified claim citing the PR. One extra conflict (Render vs a Vercel preview test) is arguably a false positive; the reviewer resolves it.
- Free hosting sleeps when idle; free model quota is small.
- Built for small software teams; not tested at scale or on other repos beyond the demo.

## Testing and feedback evidence
- Automated results: see above and `docs/evaluation.md`.
- User interviews (at least 5 planned): **[TODO: results from docs/user-research.md; real numbers only]**
- Handover test with and without Continuum: **[TODO: results from docs/testing.md; real numbers only]**

## Three major improvements for Round 3 (confirm wording)
1. **Cross-source conflict resolution.** Round 2 detects conflicts per topic and lets a reviewer resolve or defer them. Round 3 adds project-wide contradiction detection across sources and time, a side-by-side resolution screen with evidence on both sides, and resolution history.
2. **Acknowledgement loop with version diff.** Round 2 records acknowledge/unclear per section. Round 3 routes "unclear" flags back to the reviewer and leaver as tasks, and shows what changed between versions (claims added, edited, rejected, with before and after text).
3. **Sensitive-data protection.** Round 2 masks secrets/PII and hides lead-only claims. Round 3 adds a redaction review queue, a Guest role, a full audit log of views, approvals and exports, and export of the approved handover as Markdown/PDF with citations as links.
