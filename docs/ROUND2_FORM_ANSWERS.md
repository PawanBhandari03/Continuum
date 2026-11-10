# Round 2 form: paste-ready answers (form: https://forms.gle/gyRiHtQT3AnC3MdV6)

Only the team leader (Pawan) submits, once. Open every link in a private window first. Do not tick the confirmation boxes until each is true.

1. Hackathon: CodeFrontier
2. Team Name: BINARY BUILDERS
3. Team Leader: Pawan Singh Bhandari
4. Email: the same email used in Round 1 (not filled here)
5. Team members (one per line):
Pawan Singh Bhandari
Rahul Bramhankar
6. Functioning project: https://continuum-web-kodb.onrender.com
   (no sign-in; click "Enter as Reviewer". First load may take up to a minute on free hosting)
7. Repository: https://github.com/PawanBhandari03/Continuum  (must be PUBLIC)
8. Drive PDF link: [TODO: Drive link to docs/Continuum_Round2.pdf, "Anyone with the link", Viewer]

9. Features completed:
GitHub connector: README, commits, PRs and comments, issues, TODO/FIXME scan, with per-source status
Slack-format chat export upload (.zip) and notes upload (.md, .txt, .pdf) with an access label
Secrets, emails and phone numbers masked before any model sees the text; every evidence unit has an access label (public, contributor, lead_only)
AI claim extraction: atomic claims (decision, risk, dependency, owner, next action, open question, fact), each citing evidence ids with an exact quote
Lead-only evidence processed in a separate pass so it cannot leak into other claims
Verification: quote match checked by code, then a second model check (supports / partially / does not); only "supports" can be Verified
Five evidence states: Verified, Inferred, Conflicting, Missing, Confirmed
Conflict detection shown side by side, never auto-resolved; missing topics become Gap Interview questions; readiness score with visible formula
Review: approve, edit, reject, mark sensitive, redact, bulk approve; publish blocked until conflicts are resolved or deferred; publish locks the version
Version history with before/after compare
Gap Interview for the leaver; answers become new citable evidence
Role-scoped successor "Start here" view (7 sections), source chips opening original text, hidden-item count, acknowledge or flag unclear per section
Export of the role-scoped handover as Markdown or printable PDF with citation links
Audit trail (Review activity page), guided first-run tour, Reset demo button

10. Technology and implementation:
Frontend: Next.js 15 (TypeScript, App Router), Tailwind CSS v4, lucide-react; Playwright browser tests (37) including axe accessibility checks.
Backend: Python 3.11, FastAPI, Pydantic, httpx, rapidfuzz (quote matching), pypdf. A small explicit pipeline, no agent framework: ingest, mask secrets/PII, extract claims, quote check, support check, topic normalisation, dedup, conflict detection, gaps, readiness score.
Database: PostgreSQL on Supabase; row-level-security policies are in supabase/migrations/0001_init.sql, but the demo relies on the API's role checks.
AI: Google Gemini API with structured JSON output behind a swappable provider interface; batching, pacing, retry, response cache, fallback across models when the free quota runs out.
Hosting: Render (API and web), Supabase. Tests: 27 API unit tests, live API smoke test, planted-facts scorer (docs/evaluation.md: 7 of 8 planted facts found, 94 of 94 shown claims cited; one run, not an average), real-browser end-to-end test on the deployed site.
The demo handover replays a stored real run; new handovers run the live pipeline. AI coding assistance (Claude Code) is disclosed in the README.

11. Changes from the original proposal, and why:
Claude API replaced by Gemini API behind a swappable interface (Gemini has a free tier we could use throughout the build window).
shadcn/ui replaced by our own Tailwind components (saved setup time).
Local multilingual embeddings skipped; topic keys, fuzzy matching and a model contradiction check used instead (memory limits on free hosting, time).
Supabase Auth replaced by one-click demo roles sent as a header, so judges need no sign-in (real auth is a later hardening step).
Vercel replaced by Render for web and API. Python worker replaced by a background thread plus a jobs table.
Trello CSV and DOCX not built (cut list).
Demo handover replays a stored run because the free Gemini quota is small.

12. What does NOT work yet:
Roles are chosen in the UI and sent in a header; this is not a verified login. Model output varies between runs: the PR #87 UPI decision appears as an AI inference (Inferred), not a Verified claim. A fresh live run on a new handover once produced false-looking payment conflicts that the reviewer must resolve or defer; we tightened the check but have not re-measured it. One conflict can appear as two cards (Render vs Vercel; resolving one settles both). Free hosting sleeps when idle (first load up to a minute) and the free Gemini quota is small. Tested only on the CampusKart demo, not at scale or on other repos.

13. Improvement 1: Cross-source conflict resolution. Round 2 detects conflicts per topic. Round 3 adds project-wide contradiction detection across sources and time, a side-by-side resolution screen with evidence on both sides, and a resolution history, so reviewers settle disagreements instead of deferring them.

14. Improvement 2: Acknowledgement loop with version diff. Round 2 records acknowledge or unclear per section. Round 3 routes "unclear" flags back to the reviewer and leaver as tasks while the leaver is still reachable, and shows what changed between versions (claims added, edited, rejected, with before and after text).

15. Improvement 3: Sensitive-data protection. Round 2 masks secrets and PII and hides lead-only claims. Round 3 adds a redaction review queue, a Guest role, a full audit log of views, approvals and exports, and verified login with the database enforcing access.
