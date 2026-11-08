# Day 1 Playbook — what we do at 8 Nov 10:00 IST

Goal of the first 12 hours: a repo, a database with access rules, auth, the demo dataset, and one thin path that proves the pipeline shape. Everything polished later. (Hour numbers are from 8 Nov 10:00.)

## A. Pre-flight (tonight; nothing here is product code)
- [ ] Supabase project, Anthropic key (with credit), Vercel/Render linked, empty public repo exists. Keys only in local `.env`.
- [ ] Both laptops: Python 3.11+, Node 20+, Git work.
- [ ] Rahul: interview slots booked (target 5+; real answers only), UI wireframes from proposal mock-ups.
- [ ] Check WhatsApp group for submission link and Round 3 dates.
- [ ] Decide who creates the CampusKart GitHub account/repo (it must be created inside the window).

## B. Hour 0–1: repo and agreements (Pawan + Claude)
1. Initialise repo with folders: api, web, demo-data, supabase/migrations, docs. Commit README skeleton with AI-use disclosure first (first commit timestamp must be after 10:00).
2. `.gitignore` with `.env`, `__pycache__`, `node_modules`, `.next`. Add `.env.example` with variable names only.
3. Write `docs/contracts.md`: the JSON shape of Claim, Citation, EvidenceUnit, Handover view, Gap. Rahul builds UI against these with static fixtures.
4. Branch rule: small branches, merge to main often; commit messages meaningful (organisers read history).

## C. Hour 1–6: data layer (Pawan + Claude)
Tables: handovers, sources, evidence_units, claims, citations, conflicts, gaps, review_actions, acknowledgements, jobs, profiles (role).
Access labels: public < contributor < lead_only. Policies: lead reads all; contributor reads rows with label <= contributor; a claim is visible only if every cited evidence unit is visible. Seed 3 users: reviewer/lead, successor/contributor, leaver.
Test early with both users: contributor cannot read a lead_only row.

## D. Hour 1–9: frontend shell (Rahul)
Next.js + Tailwind + shadcn, Supabase auth, role-based routing, create-handover screen, connect-sources screen (fake data first), claim-ledger layout with state badges (colours for Verified/Inferred/Conflicting/Missing/Confirmed).

## E. Hour 2–9: CampusKart dataset (both)
Pawan: public repo with real commits/PRs/issues carrying the planted facts (see BUILD_PREP section 5). Rahul: Slack-style JSON export (include Hinglish lines, bots, noise, a lead-only mentor note, fake secret and fake phone/email) plus 2–3 notes files. Keep the answer key in docs/ so recall can be measured.

## F. Hour 9–27: connectors
GitHub (commits, PRs, issues, review comments, README), chat export parser (threads by thread_ts / time proximity, drop bots/short noise), notes (Markdown first, PDF second), issues. Every source records status ok/partial/failed with reason. Secret/PII scan at ingestion.

## G. Hour 25–36: first full path
Extraction → citation check → store → ledger shows it. **At hour 36 everything must be connected end to end, even if crude.** Deploy a thin version immediately after.

## H. Prompt and check specs (written now so coding is mechanical)
**Extraction call** — input: a batch of evidence units, each with a stable ID, author, timestamp, text. Instructions to the model: output only via the claim tool; each claim has type, statement, workstream, entity_key, and one or more citations each with evidence ID and an exact quote copied from that unit; never state anything not supported by a cited unit; if inferring, set `inferred=true` and say so; do not output secrets or personal data; if a unit is irrelevant, skip it.
**Deterministic checks** — ID in batch; quote fuzzy-matches (about 85+ on rapidfuzz partial ratio) the unit text; otherwise drop the citation; a claim with no surviving citation becomes Inferred or is dropped.
**Support check call** — input: claim statement + cited quote(s) only. Output: supports / partially / does_not_support with one-line reason. Only "supports" with all citations → Verified.
**Conflict check** — group by entity_key; for each small group ask "do these two claims contradict?" with both quotes and dates; store both sides, never choose.
**Gap rules** — checklist: owner for every service/credential, deploy target, open PRs without owner, unresolved questions, TODO/FIXME in risky modules, recurring unresolved problems. Missing item → Missing claim + one Gap Interview question that names the evidence found and what's absent.
**Readiness score** — share of checklist slots with Verified/Confirmed claims, minus penalties for unresolved conflicts and open gaps; formula shown in UI.

## I. Tests we run (and report honestly)
- Planted facts: found / total; share of shown claims with a valid citation.
- Permission: generate Contributor view, assert none of the lead-only text, fake secret or fake PII appears.
- Failure cases: empty source, malformed export, GitHub timeout/rate-limit, model returns invalid JSON.
- Handover test: one person tries to answer set questions about CampusKart with and without Continuum. Real results only.

## J. Submission day (hour 60–68)
Deploy check in incognito (no sign-in; demo login button or public seeded view). Updated project PDF (architecture, data flow, decisions, changes from plan, API/model/library list). Feature list. Three Round 3 improvements confirmed. Links tested incognito. Pawan files the form via the WhatsApp link by about 11 Nov 04:00, not at 09:59.

## K. First things I (Claude) will do when you say "start"
1. Scaffold repo folders, README with disclosure, .gitignore, .env.example.
2. Write docs/contracts.md and fixtures for Rahul.
3. Write the Supabase migrations with RLS and seed users.
4. Update PROJECT_OVERVIEW.md build log after each milestone.
