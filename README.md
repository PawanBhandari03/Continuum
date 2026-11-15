<div align="center">

# Continuum

### Project handovers that show their work.

[![Live demo](https://img.shields.io/badge/Live_demo-open_without_sign--in-2d54d6?style=for-the-badge)](https://continuum-web-kodb.onrender.com)
[![Judge's tour](https://img.shields.io/badge/Judge's_tour-5_minutes-0f1b3a?style=for-the-badge)](https://continuum-web-kodb.onrender.com/tour)
[![CI](https://github.com/PawanBhandari03/Continuum/actions/workflows/ci.yml/badge.svg)](https://github.com/PawanBhandari03/Continuum/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Team **BINARY BUILDERS** · CodeFrontier 2026, Problem 01: *Prevent Critical Knowledge From Leaving With People*<br>
**Pawan Singh Bhandari** (backend, AI, security) · **Rahul Bramhankar** (frontend, design, usability testing)

<img src="docs/img/r3/02-conflict.png" alt="Continuum conflicts screen: the README says Render, newer commits configure Vercel; both sides shown with source, author, date and quote" width="860">

</div>

---

## What it does

When someone leaves a project, their knowledge sits in the repo, chat, notes and issues. Continuum rebuilds the project's current state from those sources and produces a handover in which **every statement cites its source and carries an honest evidence state**. It asks the leaver only what the evidence cannot answer. A reviewer settles disagreements and approves exactly what the successor may see. The successor reads a **signed, frozen version**, acknowledges it or flags what is unclear, and sees precisely what changed in each new version.

Built for small software teams (3 to 25 people), such as student clubs and college projects where people rotate every semester.

## Try it in 5 minutes

Open the [live product](https://continuum-web-kodb.onrender.com), pick a project and a role, or follow the [Judge's tour](https://continuum-web-kodb.onrender.com/tour): each step switches role for you and opens the right screen of **your own private copy** (nothing you do affects other visitors, and copies are ready in advance so the first click is instant).

| Demo project | What it is | Who leaves, who takes over | Size |
|---|---|---|---|
| **CampusKart** | Campus marketplace app (payments, listings, sign-in) | Aditi → Karan | 94 claims from repo, chat and notes |
| **ClubSite** | College coding club website (events, members, payments) | Neha → Arjun | 33 claims, 2 conflicts, 2 gaps |
| **HackBot** | Discord bot for hackathon announcements and team matching | Dev → Priya | 29 claims, 2 conflicts, 2 gaps |

Each project was built by the real pipeline from synthetic sources and has its own team, planted conflicts, gaps, recurring problems and privacy traps.

The guided path on CampusKart:

| Step | You are | You do | You see |
|---|---|---|---|
| 1 | Reviewer | Conflicts: keep the Vercel side, write who confirmed it | One disagreement, both sources with dates, a decision history |
| 2 | Reviewer | Privacy: review what was masked | UPI ID, PAN and Aadhaar masked; a remark about a teammate waits for your decision |
| 3 | Reviewer | Questions: use the leaver's answer, then publish v2 | A new signed version |
| 4 | Successor | Start here | "What changed since you last read", only changed sections ask to be acknowledged again |
| 5 | Leaver | Gap Interview | Answers become citable evidence; keys and passwords are refused |
| 6 | Reviewer / Guest | Activity, then "Verify integrity"; enter as Guest | A tamper-evident log of every decision, view and export; the public-only view |

## The three improvements we committed to, and what shipped

| Committed to in Round 2 | Delivered | Where to see it |
|---|---|---|
| **1. Cross-source conflict resolution** | Conflicts are found across README, commits, chat and notes by comparing named values (and an AI check for the rest), with "documentation older than the code" detection. One disagreement is one card with every side, its source, author, date and quote. Five decisions (keep a side, both true, correct it, defer, reopen), each with a required reason and a full history. | Conflicts tab |
| **2. Acknowledgement loop and version diff** | Published versions are frozen with a SHA-256 fingerprint. "This is unclear" becomes a question to the leaver and reviewer; the answer becomes evidence; the reviewer attaches it and publishes the next version. The successor sees what changed (added, changed, removed, with before and after text) and re-acknowledges only changed sections. | Start here, Questions, Gap Interview |
| **3. Sensitive-data protection** | Detectors for keys, tokens, UPI IDs, PAN, Aadhaar (checksum-validated), IFSC and phone numbers; a privacy review queue where raw values never leave the server; remarks about people wait for a reviewer decision; Guest role; an audit log of views, approvals and exports where each entry fingerprints the previous one (with a Verify button); signed Markdown exports with a public Verify page; real email sign-in with database-enforced access. | Privacy, Activity, Sign in, Verify |

Also new in Round 3:

- **Works without AI.** A rules mode finds all 8 planted facts on its own and takes over automatically if the AI is unavailable.
- **Real accounts.** Email sign-in, invitations by role, and Postgres row-level security, so the database itself enforces who sees what.
- **Three demo projects** with a private copy per visitor, handed out instantly.
- **Prompt-injection protection.** Instructions hidden in source text are flagged, never followed.
- **A redesigned interface.** One colour system, a workspace sidebar with live to-do badges, a role menu, notifications; works on phones down to 375 px.
- **Faster.** A shared server cache and parallel processing: most screens answer in about 0.3 s.

## Screens

| | |
|---|---|
| <img src="docs/img/r3/04-privacy.png" alt="Privacy review queue" width="420"><br>**Privacy review.** Masked keys, UPI, PAN and Aadhaar; a remark about a teammate waits for a decision. | <img src="docs/img/r3/07-successor-what-changed.png" alt="Successor sees what changed" width="420"><br>**What changed.** The successor sees v1 → v2 and re-acknowledges only changed sections. |
| <img src="docs/img/r3/08-leaver-answer.png" alt="Leaver answers" width="420"><br>**Gap Interview.** The leaver answers only what the evidence cannot. | <img src="docs/img/r3/09-audit.png" alt="Audit log" width="420"><br>**Audit log.** Every decision, view and export, hash-chained, with Verify. |
| <img src="docs/img/r3/01-ledger.png" alt="Claim ledger" width="420"><br>**Claim ledger.** Every claim with its state, citations and review actions. | <img src="docs/img/r3/10-guest.png" alt="Guest view" width="420"><br>**Guest view.** Public material only; hidden items appear as a count. |

## Evidence states

| State | Meaning |
|---|---|
| **Verified** | A source states it and an automated check confirmed the source supports it. |
| **Inferred** | A reasonable conclusion not stated in any source; labelled "AI inference, not stated in any source". |
| **Conflicting** | Sources disagree. Every side is shown; never auto-resolved; the newest is not assumed correct. |
| **Missing** | A handover needs it but no evidence exists. Becomes a Gap Interview question. |
| **Confirmed** | A person approved or corrected it (who and when are recorded). |

## How it works

```mermaid
flowchart LR
    A[Connect<br/>GitHub, chat export,<br/>notes] --> B[Reconstruct<br/>AI or rules extract<br/>claims with citations]
    B --> C[Verify<br/>quote check, support check,<br/>conflicts, gaps]
    C --> D[Review<br/>decide conflicts, privacy,<br/>questions, edits]
    D --> E[Publish<br/>frozen, signed version]
    E --> F[Successor reads<br/>what changed, acknowledge<br/>or flag unclear]
    F -. question .-> G((Leaver answers))
    G -. new evidence .-> D
```

```mermaid
flowchart TB
    subgraph Sources
        GH[GitHub: README, commits,<br/>PRs, issues]
        CH[Chat export .zip]
        NT[Notes .md .txt .pdf]
        QA[Leaver answers]
    end
    subgraph API[FastAPI on Render]
        ING[Ingest and parse]
        PRO[Protect: mask secrets and personal data,<br/>flag prompt injection, access labels]
        EXT[Extract claims<br/>Gemini, with rules fallback]
        VER[Verify: quote match by code,<br/>then a second support check]
        CNF[Conflicts and gaps:<br/>named values, staleness, AI check]
        SNAP[Frozen versions, SHA-256,<br/>tasks, diff]
        AUD[Hash-chained audit log]
    end
    DB[(Supabase Postgres<br/>row-level security, Auth)]
    WEB[Next.js app on Render]
    Sources --> ING --> PRO --> EXT --> VER --> CNF --> SNAP --> DB
    AUD --> DB
    DB <--> WEB
```

```mermaid
flowchart TD
    M[Model proposes a claim<br/>must cite evidence ids and an exact quote] --> C1{Cited ids exist<br/>and were in the batch?}
    C1 -- no --> X[Dropped]
    C1 -- yes --> C2{Quote found in the source<br/>by fuzzy match?}
    C2 -- no --> I[Inferred]
    C2 -- yes --> C3{Second check:<br/>source supports the claim?}
    C3 -- supports --> V[Verified]
    C3 -- partly or no --> I
    V --> H[Human review] --> K[Confirmed]
    I --> H
```

```mermaid
flowchart LR
    E1[Public evidence] --> CL[A claim takes the strictest<br/>label of its evidence]
    E2[Contributor evidence] --> CL
    E3[Lead-only evidence<br/>processed in a separate pass] --> CL
    CL --> R{Can this role read<br/>ALL cited evidence?}
    R -- yes --> S[Claim shown]
    R -- no --> H[Hidden: counted, never shown,<br/>indistinguishable from not found]
```

## Tech stack

| Layer | Choice |
|---|---|
| Web | Next.js 15 (TypeScript, App Router), Tailwind CSS v4, lucide-react |
| API | Python 3.11, FastAPI, Pydantic, httpx, rapidfuzz, pypdf. A small explicit pipeline, no agent framework |
| Data and auth | Supabase: PostgreSQL with row-level security, Supabase Auth (email link, no passwords) |
| AI | Google Gemini (structured JSON output) behind a swappable interface, with an automatic rule-based fallback |
| Hosting and CI | Render (API and web), GitHub Actions |

## Measured results (all reproducible; dates in `docs/evaluation.md`)

| Check | Result |
|---|---|
| Planted facts found, AI mode / no-AI rules mode | 8 of 8 / 8 of 8 |
| Privacy and injection checks on planted items | 4 of 4 in both modes |
| Claims with a valid, checked citation | 114 of 114 (AI mode), 29 of 29 (rules mode) |
| API tests (in-memory store, no keys) | 61 passing |
| Live API end-to-end, three improvements and leak sweep | 19 of 19 |
| Browser judge path on the live site | 15 of 15 |
| Database row-level-security check (reads tables directly, bypassing the app) | 13 of 13 |
| Accessibility (axe, serious and critical) on every screen per role; phone width 375 px | pass |
| Handover test: a newcomer using Continuum as Successor | 6 of 6 handover questions correct, with evidence states |
| Real Android phone: reconstruct, review, publish, export, acknowledge | all worked; the Contributor export withheld exactly the 3 lead-only claims |
| Survey of club leads and developers | 6 responses; most-lost knowledge: why decisions were made, who owns what (4 of 6 each) |

## Run it yourself

```bash
# API: everything in memory, CampusKart preloaded, no database, no AI key, no network
cd api && pip install -r requirements.txt && python dev.py        # http://localhost:8000
# Web
cd web && npm install && NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev   # http://localhost:3000
# Tests
cd api && python -m pytest tests -q
CONTINUUM_GITHUB=snapshot python evaluate.py --offline-rules      # planted facts without any AI
cd web && npm run test:e2e                                         # browser tests (see playwright.config.ts)
```

Copy `.env.example` to `api/.env` for the real database and Gemini. Never commit keys. Deployment: `render.yaml`.

## Repository layout

```
api/                FastAPI backend, pipeline, rules mode, tests, live and database check scripts
web/                Next.js app and browser tests
supabase/migrations Schema, row-level security, accounts and membership
demo-data/          Synthetic datasets: CampusKart (chat export, notes, stored run, GitHub snapshot, answer key), ClubSite and HackBot
docs/               Round 3 report (PDF), evaluation, testing, user research, API contracts, design notes
```

## Documents

[Round 3 report (PDF)](docs/Continuum_Round3.pdf) · [Evaluation and measurements](docs/evaluation.md) · [Testing](docs/testing.md) · [User research](docs/user-research.md) · [API contracts](docs/contracts.md) · [Project overview and build log](PROJECT_OVERVIEW.md)

## Disclosure (AI use, services, libraries)

- **AI assistance:** Claude (Anthropic) via Claude Code assisted with planning and coding during the build windows. The team reviews all generated code and can explain it.
- **AI inside the product:** Google Gemini for claim extraction, support checks and contradiction checks, always behind deterministic checks (evidence ids must exist, quotes must be found in the source), and a rule-based mode that needs no AI.
- **Services:** Supabase (PostgreSQL, Auth), Render, GitHub REST API (read-only), Google Gemini API.
- **Libraries (each under its own open-source licence):** Web: Next.js, React, Tailwind CSS, lucide-react, Playwright, axe-core. API: FastAPI, Uvicorn, Pydantic, httpx, rapidfuzz, pypdf, python-multipart.
- **Templates:** `web/` was scaffolded with `create-next-app@15`; everything else is written by us.
- **Data:** all demo data is synthetic. Every key, ID number and phone number in it is fake.
- **Licence:** MIT (see [LICENSE](LICENSE)).
