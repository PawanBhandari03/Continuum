# Continuum — Project handovers that show their work

Team **BINARY BUILDERS** — Pawan Singh Bhandari (backend, AI/ML), Rahul Bramhankar (frontend, design/UX).
Built for CodeFrontier (We Code Coders), Problem 01: *Prevent Critical Knowledge From Leaving With People.*

Continuum rebuilds a project's current state from its repo, team chat, notes and task board, and turns it into a handover where every statement points to its source. It asks the leaver only what the evidence cannot answer, and lets a reviewer approve exactly what the successor may see.

**Status:** Round 2 build in progress. See [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) for the architecture, evidence model and build log.

## Repository layout
```
api/                FastAPI backend + worker (Python)
web/                Next.js frontend (TypeScript)
supabase/migrations Database schema and row-level security
demo-data/          Synthetic "CampusKart" demo dataset + answer key
docs/               Architecture, contracts, testing, user research
```

## Setup
Copy `.env.example` to `.env` (api) and `.env.local` (web) and fill values. 
**Web (mock mode, no keys needed):**
```
cd web
npm install
npm run dev          # http://localhost:3000
npm run test:permissions   # permission + publish-gate + export checks against the mock API
npm run test:unit          # permission/export checks + version-diff checks
npm run test:e2e           # Playwright judge-walkthrough in mock mode (uses installed Google Chrome)
```
Detailed API run instructions will be added as components land.

## Disclosure (AI use, services, libraries)
**AI assistance:** Claude (Anthropic) via Claude Code was used for drafting the Round 1 proposal, planning documents, and AI-assisted coding during the build window. All generated code is reviewed by the team, who can explain it.
**AI inside the product:** Google Gemini API (changed from the Round 1 plan, which named Claude) for claim extraction, support checks and contradiction checks, behind a swappable provider interface (`api/app/llm.py`). Outputs are schema-bound, verified by deterministic citation checks (evidence id must exist, quote must match the source), and require human approval before publishing.
**Services:** Supabase (PostgreSQL; Supabase Auth is not used yet), Render (API and web hosting), GitHub REST API (read-only connector), Google Gemini API.
**Libraries:** web: Next.js, React, Tailwind CSS, lucide-react, Playwright. API: FastAPI, Uvicorn, Pydantic, httpx, rapidfuzz, pypdf, python-multipart, reportlab (PDF generation for docs). Each under its own open-source licence. shadcn/ui, PyGithub and detect-secrets from the Round 1 plan are not used (own components, direct GitHub REST calls, and our own regex-based secret/PII scan).
**Data:** all demo data is synthetic. Any secrets or personal details in it are fake.
**Templates/boilerplate:** `web/` was generated with `create-next-app@15` (TypeScript, App Router, Tailwind v4); that scaffold is unmodified boilerplate apart from files we wrote. UI components (badges, cards, drawers) are written by us with Tailwind. **shadcn/ui is not used** (changed from the Round 1 plan to save setup time). Icons: `lucide-react` (ISC licence). Tests: `@playwright/test` (Apache-2.0).

**Frontend status:** `web/` talks to the real API when `NEXT_PUBLIC_USE_MOCKS=false` (the deployed site) and to a built-in, in-browser mock of the same contracts (`docs/contracts.md`) when it is `true` (local default, no keys needed; used for fast UI tests).

## Live demo, deployment and docs
- **Live site (no sign-in; click "Enter as Reviewer"):** https://continuum-web-kodb.onrender.com. A small in-app guided tour explains each step. Free hosting sleeps when idle, so the first load can take about a minute ("Waking the server" banner).
- **API:** https://continuum-api-945j.onrender.com (`/health`). Both services are deployed on Render from `render.yaml` (API: `rootDir api`, web: `rootDir web`, `NEXT_PUBLIC_USE_MOCKS=false`, `NEXT_PUBLIC_API_URL` set to the API). Secrets are entered in the Render dashboard and are never committed.
- **Web environment variables** (`web/.env.local`, names in `.env.example`): `NEXT_PUBLIC_USE_MOCKS`, `NEXT_PUBLIC_API_URL`.
- **Docs:** [docs/demo-script.md](docs/demo-script.md) (3-minute and 1-minute walkthrough), [docs/testing.md](docs/testing.md) (test evidence and known problems), [docs/user-research.md](docs/user-research.md) (survey), [docs/evaluation.md](docs/evaluation.md) (backend measurements), [docs/contracts.md](docs/contracts.md), [docs/ROUND2_SUBMISSION.md](docs/ROUND2_SUBMISSION.md), [docs/Continuum_Round2.pdf](docs/Continuum_Round2.pdf) (project document), [docs/Rahul_Manual_Testing_Report.pdf](docs/Rahul_Manual_Testing_Report.pdf) (manual testing report), [docs/RAHUL_WORK_REPORT.md](docs/RAHUL_WORK_REPORT.md) (everything the frontend and testing side did, with commit map and open items).

## Tests (web)
`npm run test:unit` (permission, export and version-diff checks on the mock API), `npm run test:e2e` (Playwright, mock mode, system Chrome). A judge-style run against the live site is `npx playwright test -c playwright.live.config.ts` (acts on the shared demo handover, then resets it). Results and open problems are in `docs/testing.md`.
