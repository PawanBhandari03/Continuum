# Rahul — Start Here

Everything you need is in this repo. Pull it, open the folder in Claude Code, and follow this file in order.

```
git clone https://github.com/PawanBhandari03/Continuum.git
cd Continuum
```

## 0. Read first (15 min, with your Claude)
1. `HANDOFF_FOR_RAHUL.md` — the full brief: rules, scoring, product, data contracts, screens, timeline. **This is your main document.**
2. `CLAUDE.md` — project rules and background (your Claude should read this every session).
3. `PROJECT_OVERVIEW.md` — plain-language overview; append to its build log as you finish things.

## 1. Paste this as the first message to your Claude
> Read CLAUDE.md, HANDOFF_FOR_RAHUL.md, PROJECT_OVERVIEW.md and RAHUL_START_HERE.md in this repo. I am Rahul, frontend owner for Team Binary Builders. The hackathon build window is open (8 Nov 10:00 IST to 11 Nov 10:00 IST); all code must be written inside it, committed in small meaningful commits, and AI use must be disclosed in README.md. I own `web/`, the CampusKart chat export + notes in `demo-data/`, and user research docs. Build against the data contracts in section 6 of HANDOFF_FOR_RAHUL.md using mock fixtures first (NEXT_PUBLIC_USE_MOCKS=true). Start with Task 1 below, then continue in order. Keep each task small, working and committed. Do not touch `api/` or `supabase/` (Pawan owns them). Never commit secrets.

## 2. Your task list (in order, each ends with a commit)
**Task 1 — Scaffold (hour 0–2).** Create the Next.js app (TypeScript, App Router, Tailwind, shadcn/ui) inside `web/`. Add `web/lib/types.ts` from the contracts, `web/mocks/` fixtures (a full CampusKart handover: all five evidence states, one open conflict, two gaps, three versions, claims in all 7 sections, a couple of claims withheld by permissions), and `web/lib/api.ts` client that returns mocks when `NEXT_PUBLIC_USE_MOCKS=true`. Add the disclosure of create-next-app/shadcn to README.

**Task 2 — Demo login + role routing.** Landing page with three buttons: Enter as Reviewer (Lead), Successor (Contributor), Leaver. Works with no sign-in. Store the chosen role (mock first; Supabase Auth later when Pawan provides keys). Role decides which screens appear.

**Task 3 — Handover list, create handover, connect sources.** Pre-seeded CampusKart handover. Create form (leaver, successor, successor role, target date). Connect page with per-source status chips (ok/partial/failed + reason), upload controls, "Use CampusKart sample sources" button.

**Task 4 — Reconstruct progress screen.** Stages: Parse, Protect, Extract, Verify, Conflicts/Gaps. Mock progress; real `/jobs/{id}` polling later.

**Task 5 — Claim ledger (the most important screen).** Group by section, filters (state/type/workstream/review status), state badges (icon + text, not colour only), owner/date, source chips, actions: approve / edit / reject / mark sensitive / redact. Readiness score with expandable formula, open conflict/gap counts, Publish button disabled with reasons. Version history drawer.

**Task 6 — Evidence viewer.** Source chip opens drawer: original text in context, quote highlighted, author/timestamp/link/label/support level, redactions as blocks.

**Task 7 — Conflict view + Gap Interview.** Side-by-side conflict with resolve or "Mark unresolved — successor to follow up" (never auto-pick newest). Leaver question page: what we found / what's missing, answer, skip, progress.

**Task 8 — Successor "Start here".** Seven sections, badges, source chips, Acknowledge / "This is unclear" per section, "N items hidden by your access level" (count only).

**Task 9 — CampusKart chat export + notes** (`demo-data/`): Slack-format export (~300–500 messages, Hinglish lines, bots/noise, lead-only mentor note with FAKE key and FAKE phone), 2–3 notes files, and `demo-data/ANSWER_KEY.md`. Facts to plant are in section 8 of the handoff. Coordinate dates and names with Pawan's repo.

**Task 10 — Wire to the real API** when Pawan confirms it's live (flip `NEXT_PUBLIC_USE_MOCKS=false`, set `NEXT_PUBLIC_API_URL`), the web app is already deployed on Render (https://continuum-web-kodb.onrender.com); do not redeploy.

**Parallel, human work (do early, not at the end):** book and run **5+ interviews** (script in handoff section 10) and log real answers in `docs/user-research.md`; later the with/without-Continuum handover test in `docs/testing.md`.

## 3. Keys and accounts you need
| Need | Who gives it | How |
|---|---|---|
| Supabase URL + anon key (for `NEXT_PUBLIC_*`) | **Pawan** | Send privately (WhatsApp/DM). **Never commit.** Put in `web/.env.local` |
| API base URL | **Pawan**, once the backend is deployed | Goes in `NEXT_PUBLIC_API_URL` |
| Hosting | **Done by Pawan** | Render (web + API), no Vercel |
| Anthropic / GitHub tokens | **Not needed by you** | Backend only |

Until the keys arrive, stay on mocks. You are not blocked.

## 4. Git rules
- Pull before you push. Small commits with real messages (organisers read history).
- Branch for each task or commit straight to `main` if it is only `web/`; never force-push.
- Only edit `web/`, `demo-data/` (chat/notes), `docs/user-research.md`, `docs/testing.md`, and small README/PROJECT_OVERVIEW updates. Contract changes: tell Pawan, edit `docs/contracts.md` in the same commit.

## 5. Checkpoints
- **Hour ~12:** Tasks 1–3 done on mocks, pushed.
- **Hour ~27:** Tasks 5–6 done (ledger + evidence viewer).
- **★ Hour 36 (= 9 Nov 22:00 IST):** all screens on mocks; first real-API connection attempted; deployed on Render.
- **Hour 60:** Everything wired, interviews logged, incognito-tested.

Message Pawan when each checkpoint is hit or if anything in the contracts doesn't fit.
