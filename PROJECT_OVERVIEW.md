# Continuum — Project Overview (living document)

*Team BINARY BUILDERS — Pawan Singh Bhandari (backend/AI), Rahul Bramhankar (frontend/design)*
*Last updated: 7 Nov 2026 (pre-build). Claude updates the "Build log" and "Current status" sections as we build.*

> How this file relates to the others: **CLAUDE.md** = instructions and rules for Claude (scope, deadlines, working agreements). **PROJECT_OVERVIEW.md** (this) = what we're building and how, for humans, updated as we go. **BUILD_PREP.md** = pre-window planning. **DAY1_PLAYBOOK.md** = exact steps for the first hours.

## 1. What Continuum is
**Tagline:** Project handovers that show their work.

When someone leaves a project team, their knowledge leaves with them. Continuum rebuilds the project's current state from its repo, team chat, notes and task board, and turns it into a handover where **every statement points to its source**. It asks the leaver only the questions the evidence can't answer, and lets a reviewer approve exactly what the successor is allowed to see.

Problem it answers (hackathon Problem 01): *Prevent critical knowledge from leaving with people.*
Target users: small software teams (3–25 people), especially student tech clubs where members rotate every semester.

## 2. The five-step workflow (what a judge must be able to do)
1. **Connect** — reviewer creates a handover (leaver, successor, role, date) and connects a GitHub repo, a chat export, notes, and issues.
2. **Reconstruct** — the system extracts atomic *claims* (decisions, risks, owners, dependencies, next actions, open questions).
3. **Verify** — every claim's citation is checked; claims get an evidence state; conflicts and gaps are detected; a readiness score is computed.
4. **Review** — a reviewer approves, edits, rejects, redacts or marks claims sensitive. Version history is kept. Publishing locks the version.
5. **Handover** — the successor opens a "Start here" page, clicks source chips to see the original text, and acknowledges or flags sections. They see only what their role may see.

## 3. The four ideas that make it different
1. **Claims, not summaries** — each claim has an evidence state and source links.
2. **Gap Interview** — the leaver answers targeted questions only where evidence is missing or conflicting; answers become citable evidence ("Exit Q&A").
3. **Permission before generation** — access labels are applied before text reaches the AI; Postgres row-level security enforces it in the database.
4. **Handover as a loop** — the successor's "unclear" flags route back to the reviewer and leaver while the leaver is still reachable.

## 4. Evidence states (the trust model)
| State | Meaning |
|---|---|
| Verified | A source states it directly AND an automated check confirms the source supports it |
| Inferred | Reasonable conclusion, not in any source; labelled "AI inference — not stated in any source" |
| Conflicting | Sources disagree; both shown; never auto-resolved; newest is not assumed correct |
| Missing | Something a handover needs has no evidence; becomes a Gap Interview question |
| Confirmed | A human reviewer approved/corrected it (who and when recorded) |

## 5. How it works (architecture)
```
Sources: GitHub API | Slack/Discord JSON export | notes (MD/PDF) | GitHub Issues | Exit Q&A
   -> Ingestion (Python worker): parse -> evidence units; secret/PII scan; access label
   -> Evidence store: PostgreSQL (+ pgvector later) on Supabase, row-level security
   -> Reconstruction (FastAPI + Claude API):
        1 permission filter -> 2 extract claims (schema-bound, must cite IDs)
        -> 3 verify citations (quote match + support check) -> 4 conflicts, gaps, readiness
   -> Next.js app: claim ledger/review | Gap Interview | role-scoped handover
```
**Trust pipeline in plain words:** the AI may only output structured claims that cite evidence IDs and quote the supporting text. We then check, with ordinary code, that the IDs exist and the quote really appears in the source. A second narrow AI call judges whether the source supports the claim. Only claims passing both can be "Verified". A human must approve before publishing.

**No leaking:** every evidence unit carries an access label; a claim takes the most restrictive label among its evidence; the successor's view is built only from what their role may read.

## 6. Tech stack
| Layer | Choice |
|---|---|
| Frontend | Next.js (TypeScript), Tailwind CSS, shadcn/ui |
| Backend | Python, FastAPI, Pydantic |
| Database/auth | PostgreSQL on Supabase, Supabase Auth, row-level security |
| AI | Anthropic Claude API (structured output via tool use) |
| Libraries | PyGithub, pypdf, python-docx (if time), rapidfuzz, detect-secrets |
| Embeddings | multilingual-e5-small — optional in Round 2 |
| Jobs | Python worker + Postgres job table |
| Hosting | Vercel (web), Render (API + worker), Supabase |

## 7. Demo data
Synthetic project **CampusKart** (campus marketplace app). Planted facts: UPI payments decision (PR #87), README-vs-Vercel conflict, ownerless college SMTP account, risky "temporary fix" in auth, a lead-only note that must never reach the Contributor view. All data is synthetic; secrets/PII in it are fake. Cast: leaver Aditi, successor Karan.

## 8. Roles in the product
Lead/reviewer (sees everything, approves), Contributor/successor (sees only permitted claims), Leaver (answers Gap Interview). Round 3 adds Guest and a full audit log.

## 9. Timeline
- Round 2 build: **8 Nov 10:00 → 11 Nov 10:00 IST**. Only Pawan submits. Judges must be able to use the live link without sign-in or walkthrough.
- Round 3: dates to be confirmed (earlier note: 13–16 Nov).
- **Code rule:** nothing but docs committed before 8 Nov 10:00. Disclose AI assistance in the README.

## 10. Three improvements promised for Round 3
1. Cross-source conflict resolution (side-by-side screen).
2. Acknowledgement loop + version diff (v1 → v2).
3. Sensitive-data protection: PII/secret redaction queue, Guest role, audit log, PDF/Markdown export with citation links.

## 11. Honest limitations (to keep updated)
- Built for small software teams; not tested at enterprise scale.
- Source coverage limited to GitHub, chat export, notes, issues.
- Automated verification reduces but doesn't eliminate wrong claims; human review is required.
- (Add real measured limitations here as we find them.)

## 12. Current status
Round 2 build in progress (started 8 Nov 10:00 IST). **Frontend (Rahul + Claude):** all screens exist and work end to end on a built-in mock API: demo login by role, handover list + create, connect sources, reconstruct progress, claim ledger (filters, actions, readiness formula, version history, publish gate), evidence drawer, conflict resolution, Gap Interview, successor Start here with acknowledge / unclear. **Backend (Pawan):** see `api/` and `supabase/`. Not yet connected.

## 13. Build log (Claude appends as we go)
| When | What was built / decided | Notes |
|---|---|---|
| 7 Nov | Planning docs written | No code |
| 8 Nov | `web/` scaffolded (Next.js 15, Tailwind v4), typed contracts in `web/lib/types.ts` | Rahul + Claude |
| 8 Nov | Mock API + CampusKart fixture (`web/mocks`, `web/lib/mock-api.ts`): five evidence states, 1 conflict, 2 gaps, versions, 2 lead-only claims | In-browser, persisted in localStorage; enforces the same permission rule as the real system |
| 8 Nov | All 8 screens built on the mock API (see section 14) | UI works end to end without keys |
| 8 Nov | `web/tests/permissions.test.ts`: 17 checks (contributor view has no lead-only text/fake key/fake phone; publish gate) all pass | Tests the **mock** only. The real API/RLS needs its own test |

## 14. Frontend guide (for teammates)
**Run it:** `cd web && npm install && npm run dev`, open http://localhost:3000. No keys needed; it runs on mock data.

**Where things are**
| Path | What |
|---|---|
| `web/lib/types.ts` | TypeScript version of the data contracts (HANDOFF section 6). Added one section key, `project` ("Project in five lines"), which the contract enum lacked. |
| `web/lib/api.ts` | One client interface. `NEXT_PUBLIC_USE_MOCKS=true` uses the mock; `false` calls the FastAPI at `NEXT_PUBLIC_API_URL`. |
| `web/lib/mock-api.ts`, `web/mocks/campuskart.ts` | Mock backend + synthetic CampusKart data. Applies the "claim visible only if the role may read ALL cited evidence" rule. |
| `web/lib/session.tsx` | Demo role entry (no sign-in). Replaced by Supabase Auth when keys exist. |
| `web/components/evidence.tsx` | Source chips and the evidence drawer (quote highlighted, redactions as blocks). |
| `web/app/handovers/[id]/...` | `connect`, `reconstruct`, `ledger`, `conflicts`, `interview`, `start` screens. |

**Judge walk-through (about 3 minutes):** Enter as Reviewer → open CampusKart → ledger: click a source chip → Conflicts: mark it or resolve it → switch to Leaver and answer a question → back as Reviewer: "Approve all Verified claims", approve the rest, Publish → switch to Successor: see the handover, note "N items hidden by your access level", acknowledge or flag a section.

**Known limitations (frontend):** mock data lives in the browser, so it is per-browser and "Reset demo" clears it. The successor view shows a draft preview before publish (labelled) so judges can explore without finishing review. File uploads in mock mode register a source but do not parse the file. Tokens typed into the GitHub field are never stored. Accessibility: badges use icon + text, controls are keyboard reachable; not yet audited with a screen reader.
