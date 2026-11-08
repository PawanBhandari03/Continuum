# Continuum — CodeFrontier Hackathon (Team Binary Builders)

This file is the single source of truth for the project. Read it fully at the start of every session.
The submitted Round 1 proposal is `Continuum_BinaryBuilders_Round1.pdf` (source: `proposal.html`) in this folder. Drive link submitted to organisers: https://drive.google.com/file/d/1AbtGRwOADi4as1EHNxZbkuRfrEgSmtR8/view

## 1. The hackathon

- **Event:** CodeFrontier, run by We Code Coders (HackWithPune messages are the same event). Event page: https://wecodecoders.in/events/codefrontier — it overrides Unstop info.
- **Format:** three rounds, one problem statement for every team. 1,000+ teams in Round 1, top 300 advance.
- **Dates (IST):**
  - Round 1 (The Plan): 5–6 Nov 2026, PDF proposal due 6 Nov 18:00. Results emailed same night.
  - Round 2 (The Build): **OFFICIAL (selection email, 7 Nov): opens Sun 8 Nov 10:00 IST, closes Wed 11 Nov 10:00 IST.** (Earlier note said 7–10 Nov; superseded.) We are one of 59 teams selected. **Only the team leader (Pawan) submits, one per team.** Submission link will be posted in the WhatsApp group https://chat.whatsapp.com/HAmk6bZBLG68jT7259acBi (keep checking). Submit: working project link, repo link, updated project PDF, list of completed features, technology/implementation details, changes from the original plan, three major (non-cosmetic) Round 3 improvements. **A judge must open the link and use the core product without assistance or walkthrough. All links must open without sign-in — test in incognito.** Late submissions are not evaluated. Prizes: PPO/incubation (Inkloom AI), Rs 30,000, credits.
  - Round 3 (The Finish): **13–16 Nov, 72 hours from 10:00.**
- **No late window.** Missing a round's deadline ends the event for the team.
- Every participant submits individually each round (same project, own role in own words). No submission = no certificate.
- Official Round 1 PDF format: we received none, so we used our own layout.

### Rules that matter for building
- **All code must be written inside the build window** (Round 2 starts 8 Nov 10:00 IST). Organisers can check repo commit history and file metadata. Planning and research beforehand are fine. **Do not commit code before 8 Nov 10:00 IST.** Only README / proposal / docs may be committed earlier.
- Disclose templates, boilerplate, previous code, significant AI tools and AI-generated components. AI-assisted coding is allowed if disclosed (list it in the repo README).
- Use only synthetic, public, permissioned or anonymised data in demos. Never encourage uploading confidential material.
- Existing libraries, APIs, frameworks and open-source components are allowed under their licences.
- Judges can ask any member to explain the product or verify their contribution. Both members must understand the whole system.
- Do not try to game AI/automated judges (no hidden text etc.) — disqualification risk.

## 2. Team

- **Team name:** Binary Builders (write BINARY BUILDERS in capitals on forms)
- **Pawan Singh Bhandari** — team lead. Backend · AI/ML.
- **Rahul Bramhankar** — Frontend · Design/UI-UX.

### Who builds what
**Pawan:** source connectors (GitHub API, Slack/Discord export, docs parsers); evidence store schema, access labels, Postgres row-level security; claim extraction pipeline with the Claude API; verification layer (citation checks, support check, evidence states); conflict and gap detection; Gap Interview question generator; FastAPI endpoints, background worker, backend deployment.

**Rahul:** Next.js app: workspace setup, create-handover and connect-sources screens; claim ledger review UI (approve/edit/reject/redact, readiness score, version history); evidence viewer (source chip opens original text in context); Gap Interview page for the leaver; successor "Start here" handover view with acknowledge / "unclear" flags; auth and role-based routing on frontend; web deployment; user interviews and usability testing; demo flow and presentation.

**Shared:** synthetic "CampusKart" demo dataset (Pawan: repo and planted facts; Rahul: chat and notes), testing, docs/README, round documents.

## 3. The problem statement (Problem 01)

**Prevent Critical Knowledge From Leaving With People.** One-liner: *Build a system that converts scattered project activity into a usable handover when a team member leaves.*

The brief asks for a platform that reconstructs project state from **authorised sources**: decisions, unresolved questions, responsibilities, risks, dependencies, next actions. Every generated summary must link to its source and clearly mark uncertainty, missing evidence or conflicting information. Users must be able to review, correct and approve before sharing. It must reduce transition time **without exposing information the incoming person is not authorised to see**.

**Required core workflow:** 01 Connect → 02 Reconstruct → 03 Verify → 04 Review → 05 Handover.

**Trust requirements:**
1. Do not present generated assumptions as verified organisational truth.
2. Do not expose confidential info merely because it appeared in a connected source.
3. Allow authorised users to correct, reject and approve the final handover.
4. Use synthetic, public, permissioned or anonymised data for demos.

**Suggested capabilities in the brief:** import from docs/repos/tasks/notes/chat; highlight missing/contradictory info instead of inventing; timeline of decisions; handover views by role and permission; ownership/dependency/blocker/recurring-problem/next-action identification; review, correction, approval, version history, acknowledgement of receipt; citations on important claims; access controls, redaction, secure data handling.

### How each round is judged (100 points each)
- **Round 1 (done):** Understanding of problem 25 · Proposed solution 25 · Technical plan 20 · Originality 15 · Feasibility and scope 15.
- **Round 2 (The Build):** Core workflow runs end to end **30** · Technical depth and reliability 25 · Progress against the plan 20 · Three planned improvements 15 · Usability so far 10.
  - Submit: functional product/MVP, deployed link or installable package, public/judge-accessible repo, updated project document (architecture, data flow, technical decisions), list of APIs/AI models/datasets/libraries/templates/external services, features completed, changes from Round 1 plan, testing/feedback evidence, **three substantial improvements committed for Round 3**.
  - "Rough edges are acceptable, but the central workflow must work. A visually polished interface cannot compensate for missing evidence, unreliable output or a broken handover process."
- **Round 3 (The Finish):** Completeness 25 · Improvements delivered 20 · Reliability under normal use 20 · Usability and real-world fit 20 · Documentation and roadmap 15.
  - Submit: final product + repo, demo video or live demo, concise final presentation/report, evidence the 3 improvements shipped, testing notes (journeys, failure cases, permissions, reliability), privacy/security/accessibility/responsible-design explanation, known limitations, realistic roadmap, participant and contribution details.
  - "Trustworthy limitations score better than unsupported claims of complete automation." Judges assess what is demonstrated, not what is described.

## 4. The product: Continuum

**Tagline:** Project handovers that show their work.

Continuum rebuilds the current state of a project from its repo, team chat, notes and task board, turns it into a handover where every statement points to its source, asks the leaver only the questions the evidence cannot answer, and lets a reviewer approve exactly what the successor may see.

**Setting we chose:** active software projects in small teams (3–25 people), primarily student tech clubs / college project teams (turnover every semester). Generalises to startups, research groups, volunteer teams.

**Users:** departing member (leaver), incoming member (successor), reviewer (team lead / mentor / coordinator), workspace admin.

### Four differentiating ideas
1. **Claims, not summaries.** The handover is built from atomic claims. Each has an evidence state and source links.
2. **Gap Interview.** Instead of a blank document, the leaver answers a short list of targeted questions only where evidence is missing or conflicting. Answers become new citable evidence ("Exit Q&A").
3. **Permission before generation.** Access labels are applied before text reaches the AI. A successor's view is generated only from sources their role may read. Postgres row-level security enforces this in the database.
4. **Handover as a loop.** Successor acknowledges each section or flags it "unclear"; flags route back to reviewer and leaver while the leaver is still reachable.

### Evidence states
- **Verified** — at least one source states it directly and an automated check confirms the source supports it.
- **Inferred** — reasonable conclusion, not stated in any source; labelled in the text ("AI inference — not stated in any source").
- **Conflicting** — sources disagree; both shown side by side; never auto-resolved; newest is NOT assumed correct.
- **Missing** — something a handover needs has no evidence; listed as a gap and turned into a Gap Interview question.
- **Confirmed** — a human reviewer approved/corrected it (records who and when).

### Handover contents (what the successor receives)
1. Project in five lines. 2. Current state by workstream. 3. Decision log (timeline with reasons). 4. Your first week (ordered next actions linked to issue/PR/thread). 5. Risks and landmines (recurring problems, workarounds, fragile parts). 6. Dependencies and people (services, credential owners, who to ask). 7. Still unresolved (open questions and conflicts, stated honestly).

### Workflow
1. **Connect** — reviewer creates a handover (leaver, successor, successor's role, target date), connects GitHub repo (read-only token), uploads Slack/Discord export, notes, task-board export; chooses in-scope channels/folders. System parses into evidence units, scans for secrets/PII, attaches access labels.
2. **Reconstruct** — group evidence by thread/time, extract claims, build decision timeline, ownership map, risk list, dependency list, next actions.
3. **Verify** — check every citation, assign evidence states, detect conflicts and gaps, compute handover readiness score; leaver answers Gap Interview; answers folded back as evidence.
4. **Review** — reviewer goes through the claim ledger: approve, edit, reject, mark sensitive, redact. Conflicts must be resolved or marked "unresolved — successor to follow up". Version history; approved version is locked on publish.
5. **Handover** — successor opens "Start here" page, clicks source chips to see originals, acknowledges sections or flags unclear. Only claims whose evidence their role may see are shown.

## 5. Architecture and tech stack

```
Sources (GitHub API · Slack/Discord JSON export · notes/docs MD/PDF/DOCX · GitHub Issues/Trello CSV · Exit Q&A)
  -> Ingestion & protection (Python worker): parse -> evidence units; secret & PII scan/redaction; access label from source ACL; embeddings
  -> Evidence store: PostgreSQL + pgvector on Supabase (row-level security enforces access labels)
  -> Reconstruction engine (FastAPI + Claude API): 1 permission filter -> 2 extract claims (schema-bound, must cite IDs)
       -> 3 verify citations (quote match + support check) -> 4 merge, conflicts, gaps
  -> Next.js web app: claim ledger & review · Gap Interview · role-scoped handover
  (Gap Interview answers are stored back as new evidence)
```

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (TypeScript), Tailwind CSS, shadcn/ui | Fast to build review-heavy UIs; easy deploy |
| Backend | Python, FastAPI, Pydantic | Best parsing/AI ecosystem; Pydantic models double as the claim schema |
| Database & auth | PostgreSQL + pgvector on Supabase, Supabase Auth | One service for relational + vector + auth; row-level security enforces access in the DB |
| AI model | Anthropic Claude API | Long messy inputs, strict structured output via tool use / JSON |
| Embeddings | multilingual-e5-small (open source, local) | Free, private, handles Hindi–English ("Hinglish") chat |
| Jobs | Python worker + Postgres job table | No separate queue service |
| Libraries | PyGithub, pypdf, python-docx, rapidfuzz, detect-secrets | Parsing, quote matching, secret detection |
| Hosting | Vercel (web), Render (API + worker), Supabase | Free tiers, live link for judges |

Alternatives rejected: separate vector DB (Pinecone/Chroma) — pgvector keeps permissions and vectors together; LangChain-style agents — small explicit testable pipeline instead.

### Evidence data model
Source (type, name, scope, default_access_label, connected_by) · EvidenceUnit (source_id, author, timestamp, text, url/locator, access_label, redactions[], embedding) · Claim (type, statement, state, confidence_reason, workstream, owner) · Citation (claim_id, evidence_id, quote_span, support full/partial) · Handover (leaver, successor, successor_role, status, version, approved_by, published_at) · ReviewAction / Ack (who, action, before/after, time · section, acknowledged/unclear).

### The hard technical problems and our answers
1. **Trustworthy claims.** Bounded batches with stable evidence IDs -> schema-bound JSON extraction (type, statement, cited IDs, exact supporting quote; free text rejected) -> deterministic checks (IDs exist and were in the batch; quote fuzzy-matches source via rapidfuzz; failures dropped or downgraded to Inferred) -> second narrow model call "supports / partially / does not" (only "supports" can be Verified) -> human confirmation before publish.
2. **No leaking.** Filter before generation; each evidence unit inherits an access label; handover generated only from units the role may read; RLS in Postgres; a claim takes the most restrictive label of its evidence (if the successor cannot see all evidence, they do not see the claim); secrets/PII redacted at ingestion; reviewer can mark sensitive/redact.
3. **Conflicts and staleness.** Group claims by entity key (module/service/person) + embeddings; detect contradictions; show both sides with dates; block publishing until resolved or marked unresolved.
4. **Noisy input and cost.** Cheap noise filtering (bots, reactions, very short messages), thread messages before extraction, cache per batch, cap batch size, retry with back-off, and show which sources are incomplete instead of silently producing a partial handover.

## 6. Scope and plan

### Round 2 scope (must work end to end)
GitHub connector (commits, PRs, issues, review comments, README via read-only token); Slack/Discord official JSON export parser; notes/docs upload (Markdown/PDF; DOCX if time); task board via GitHub Issues (Trello CSV is optional); evidence store with access labels; project-state reconstruction; claim verification with the four evidence states; Gap Interview; review and approval with readiness score, version history, publish lock; role-scoped handover view with source chips (two roles: Lead and Contributor).

### Round 2 milestones (72 h window, hours from start)
- M1 hrs 0–18: repo, schema, auth, demo dataset (both)
- M2 hrs 9–27: connectors -> evidence units (Pawan)
- M3 hrs 25–45: extraction + verification + gaps (Pawan)
- M4 hrs 9–45: review UI, evidence viewer, handover view (Rahul)
- M5 hrs 54–72: integrate, deploy, test, document (both)
- **Rule:** by hour 36 the whole flow is connected with simple versions of every stage before any stage is polished.

### Three improvements promised for Round 3 (must deliver — we wrote these in the plan)
1. **Cross-source conflict resolution** — project-wide contradiction detection with a side-by-side resolution screen.
2. **Acknowledgement loop + version diff** — successor acknowledges or flags sections; flags route back; reviewers see v1 -> v2 changes.
3. **Sensitive-data protection** — automatic secret/PII detection, redaction queue, extra roles (e.g. Guest), full audit log of views, approvals and exports. Also: export approved handover as PDF/Markdown with citations as links.

(When writing the Round 2 submission, confirm or adjust these three — they must be "substantial improvements", not cosmetic.)

### Cut list if we fall behind
Drop Trello first (GitHub Issues stays) -> DOCX out, Markdown/PDF only -> one role view instead of two (keep the permission filter itself). **Never cut:** citations, evidence states, review and approval.

### Demo data
Synthetic project **"CampusKart"** (campus marketplace app): a public repo we create during the window, plus a generated Slack/Discord-style chat export and notes. Plant known facts so we can measure recall. Cast used in proposal mock-ups: leaver Aditi, successor Karan. Planted examples already referenced in the proposal: payments moved from card gateway to UPI deep links in August (PR #87) because of merchant KYC; README says Render but commits since 2 Oct configure Vercel (conflict); college SMTP account has no owner (missing); PR #91 "temporary fix for login loop" with TODO in auth/session.ts (inferred risk).

### Test plan (also evidence for judging)
- Planted-facts test: how many planted decisions/conflicts/gaps are found; share of shown claims with a valid citation (target: all).
- Permission test: generate a Contributor view and assert no text from lead-only sources appears.
- Failure cases: empty sources, malformed exports, API timeouts.
- Round 2 also needs "evidence of testing or structured feedback": run the planned user interviews (at least five club leads/mentors/maintainers) and a handover test (successor with and without Continuum). Report real results only; no invented numbers.

## 7. Working agreements for Claude

- Be honest in all docs and the product: state limitations; never claim unmeasured numbers.
- Judges reward a **working central workflow** over polish. Build the thinnest end-to-end path first.
- Keep the AI honest in-product: nothing shown as Verified unless the citation check passes.
- Never commit secrets (API keys, tokens). Use `.env` files and add them to `.gitignore`.
- Disclosure: keep a section in the repo README listing AI tools used (Claude for drafting the proposal and any AI coding assistance), third-party services, open-source libraries and licences.
- Do not write product code before 8 Nov 2026 10:00 IST. Before that, only docs/planning.
- Round documents: Round 2 needs an updated architecture/data-flow document, API/model/library list, changes from Round 1 plan, testing evidence. Round 3 needs report, limitations, roadmap, accessibility/privacy explanation.

## 8. Status log

- 2026-11-06: Round 1 proposal (16-page PDF) finished and uploaded to Drive; link tested anonymously (works). Both members to submit the Google Form individually before 18:00 IST.
- 2026-11-07: Round 1 passed (selected, 59 teams in Round 2). Window is 8 Nov 10:00 -> 11 Nov 10:00 IST. Round 3 dates not yet confirmed in the email (earlier note said 13-16 Nov; verify). BUILD_PREP.md written (hours there are relative to window start).
- (Superseded) Next: wait for the Round 1 result email (6 Nov, ~23:59); create GitHub repo in this folder (docs only until the window opens); prepare synthetic CampusKart data design; Round 2 build starts 7 Nov 10:00.
