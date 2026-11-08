# Continuum — Round 2 Build Prep (docs only, no code before 8 Nov 10:00 IST; window closes 11 Nov 10:00 IST — "hour 0" below = 8 Nov 10:00, hour 72 = 11 Nov 10:00. Aim to submit by hour ~68, not the last minute.)

Purpose: remove every decision we can before the window opens, so hour 0 is typing, not debating.

## 1. Pre-window checklist (non-code, do tonight / before 10:00)
- [ ] Supabase project created (free tier); note URL, anon key, service key -> `.env` only, never committed.
- [ ] Anthropic API key with credit; confirm which model for extraction (cheap/fast) vs support-check (same, narrow prompt). Keep model name in one env var.
- [ ] Vercel + Render accounts linked to the GitHub org/repo.
- [ ] GitHub: empty repo `continuum` (docs only), public. Second account/org for the CampusKart demo repo (created inside the window).
- [ ] GitHub fine-grained read-only token for demo repo (create after the repo exists, in window).
- [ ] Python 3.11+, Node 20+, pnpm/npm, Git installed on both laptops. Confirm `pip` can install `sentence-transformers` (multilingual-e5-small is ~120 MB; Render free tier RAM is tight — see risk R2).
- [ ] Agree git workflow: `main` protected-by-convention, short feature branches, Pawan owns `/api`, Rahul owns `/web`, shared `/demo-data` and `/docs`.
- [ ] Rahul: pick shadcn/ui component list + wireframes from the proposal mock-ups so UI work starts on hour 0.
- [ ] Pawan: write the planted-facts answer key (below) on paper/doc, not code.

## 2. Repo layout (to create at 10:00)
```
continuum/
  README.md            (AI-use disclosure, libs, licences, setup)
  docs/                (architecture, data flow, decisions, test report, round docs)
  api/                 (FastAPI + worker)  <- Pawan
    app/ routers/ services/ connectors/ pipeline/ models/ tests/
  web/                 (Next.js)           <- Rahul
  demo-data/           (CampusKart chat export, notes, answer key)
  supabase/migrations/ (schema + RLS)
```

## 3. Decisions to lock now (so nobody re-debates)
| Topic | Decision | Reason |
|---|---|---|
| Auth | Supabase Auth, email magic link; 3 seeded demo users (Lead/reviewer, Contributor/successor, Leaver) | Fastest; no OAuth setup |
| API <-> DB | FastAPI uses service key for the worker; user-facing reads go through Supabase with user JWT so RLS actually applies | RLS must be real, not decorative |
| Access labels | 3 levels: `public` < `contributor` < `lead_only`. Claim label = max (most restrictive) of cited evidence | Matches "most restrictive wins" rule |
| Roles | `lead` sees all; `contributor` sees public+contributor; Guest added in Round 3 | Two roles in R2 scope |
| Extraction | One Claude call per bounded batch (~30–40 evidence units), forced tool-use returning a JSON array | Schema-bound, cacheable |
| Claim fields | type (decision/risk/dependency/owner/next_action/open_question/fact), statement, workstream, entity_key, cited evidence IDs, exact quote per citation, label | entity_key drives conflict grouping |
| Verification | (1) IDs exist and in batch; (2) rapidfuzz partial_ratio of quote vs unit text >= ~85; (3) second narrow call: supports / partial / not. Only "supports" -> Verified; fail quote check -> drop or Inferred | Core trust feature, never cut |
| Conflicts | Same entity_key, different value claims -> LLM pairwise "do these contradict?" on small groups only; store as Conflict row linking claims; never auto-resolve | Cheap and explainable |
| Gaps | Rule list of "things a handover needs" (owner of each service, credentials owner, deploy target, open PRs with no owner, TODOs) checked against claims; missing -> Missing claim + interview question | Deterministic, testable |
| Readiness score | % of required handover slots filled with Verified/Confirmed, minus penalty for unresolved conflicts and open gaps. Show the formula in UI | Honest, explainable |
| Embeddings | Make optional behind a flag. R2 conflict grouping uses entity_key + rapidfuzz first; add e5 embeddings only if time | Reduces deploy risk (R2 below) |
| Job runner | Postgres `jobs` table, worker polls every few seconds; status shown in UI per source | No queue service |
| Errors | Every source has a status (ok / partial / failed + reason) surfaced in UI | Spec rule: never silently partial |

## 4. API surface (draft, for Rahul to mock against from hour 0)
- `POST /handovers` create (leaver, successor, role, target date)
- `POST /handovers/{id}/sources` (github | chat_export | notes | issues_csv) + `GET .../sources` with status
- `POST /handovers/{id}/reconstruct` -> job id; `GET /jobs/{id}`
- `GET /handovers/{id}/claims?state=&type=&workstream=`; `PATCH /claims/{id}` (approve/edit/reject/redact/mark-sensitive) -> writes ReviewAction
- `GET /claims/{id}/evidence` (citations with quote spans + surrounding context)
- `GET /handovers/{id}/gaps` and `POST /gaps/{id}/answer` (Exit Q&A becomes new evidence unit, source type `exit_qa`)
- `GET /handovers/{id}/readiness`
- `POST /handovers/{id}/publish` (blocks if unresolved conflicts not marked; locks version)
- `GET /handovers/{id}/view` (role-scoped; successor) and `POST /handovers/{id}/ack` (section, acknowledged|unclear)
Agree the JSON shapes of Claim and Handover view on day 0 and have Rahul build against a static fixture until the API is live.

## 5. CampusKart planted-facts answer key (design now, generate in window)
Recall target: every item below must be found or correctly flagged.
1. Decision: payments moved from card gateway to UPI deep links in August, PR #87, reason merchant KYC (Verified; cites PR + chat).
2. Conflict: README says deploy on Render; commits since 2 Oct configure Vercel.
3. Gap: college SMTP account has no named owner.
4. Inferred risk: PR #91 "temporary fix for login loop", TODO in `auth/session.ts`.
5. Dependency: image uploads via a third-party bucket; credential held by one named person (Verified).
6. Recurring problem: "build fails on Windows path" raised 3 times in chat across weeks.
7. Open question: unanswered chat thread about whether to keep COD (cash on delivery) — no resolution.
8. Next action: PR #94 open, reviewer requested changes, no activity 3 weeks.
9. **Permission trap:** a lead-only note (e.g. a mentor feedback on a member + a fake API key string like `sk_test_FAKE...`) that must never appear in the Contributor view; also a fake phone number/email for the PII redaction demo.
10. Noise: bot messages, "ok", "👍" threads that must be filtered.
Use clearly fake secrets and fake PII only. Chat should include some Hinglish lines to justify the multilingual choice.

## 6. Hour-by-hour plan (hours from 10:00 on 7 Nov)
- **0–2** Both: repo, env, Supabase project, shared fixture of Claim/Handover JSON, agree API shapes.
- **2–9** Pawan: migrations (sources, evidence_units, claims, citations, handovers, review_actions, acks, jobs, conflicts, gaps) + RLS policies + seed users. Rahul: Next.js shell, Supabase auth, routing by role, create-handover + connect-sources screens (mock data).
- **Parallel Rahul/Pawan** CampusKart repo + chat + notes generation (share the load, 2–3 h total).
- **9–27** Pawan: GitHub connector, chat export parser, MD/PDF parser, issues -> evidence units, noise filter, secret/PII scan. Rahul: claim ledger UI, evidence viewer drawer.
- **25–36** Pawan: extraction + citation verification wired. **Hour 36 gate: full path runs with simple versions of every stage.** Rahul: handover view, Gap Interview page.
- **36–45** Pawan: support check, conflicts, gaps, readiness. Rahul: review actions, publish, version history, ack buttons.
- **45–54** Integration bugs, permission test, planted-facts test, failure cases.
- **54–72** Deploy (Vercel/Render), user interviews (>=5, run earlier in background by Rahul), handover test, docs, README disclosure, Round 2 submission pack, tag the commit, record backup demo video.

## 7. Risks and mitigations
- **R1 LLM output flakiness:** forced tool-use schema, Pydantic validation, one retry with the validation error, then drop and log. Cache raw responses per batch to disk/DB so reruns are free during debugging.
- **R2 Render free tier memory / cold start:** the local e5 model may not fit. Fallback: skip embeddings in R2 (see decision table). Also warm the API before demos; free instances sleep.
- **R3 RLS complexity eating hours:** write the 3–4 policies early (hour 2–9) and test with the two seeded users; if stuck, keep API-side filtering plus RLS on the evidence and claims tables only.
- **R4 API cost / rate limits:** cap batch size and total calls per run; show token count in logs; use the smaller model for the support check.
- **R5 Time-window rule:** commit only after 10:00; commit regularly (organisers check history). Do not paste pre-written code from old projects without disclosing.
- **R6 Judges need a working link:** deploy a thin version by hour ~40, not at the end. Seed the deployed instance with CampusKart so judges can click through without connecting anything.
- **R7 Scope creep:** anything not in section 6 of CLAUDE.md waits for Round 3. Cut order is already defined there.

## 8. Round 2 submission pack (start collecting notes from hour 0)
Keep a running `docs/build-log.md`: decisions, changes from Round 1, what broke. Needed at the end: architecture + data-flow doc, list of APIs/models/libs/services, features completed, deviations from plan, test evidence (planted-facts results, permission test, failure cases, interview notes), and the three Round 3 improvements (confirm wording from CLAUDE.md section 6).

## 9. How we work together once the clock starts
Say "start" and I'll scaffold `api/` and `supabase/migrations/` first and the shared fixtures, then build the connectors and pipeline in the order above, committing as we go with the AI-use disclosure kept up to date in the README.
