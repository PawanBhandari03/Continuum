# Round 3 plan — Continuum (planning only; no code before the window)

Window: **Fri 13 Nov 23:59 IST → Mon 16 Nov 23:59 IST** (72 h). Hour 0 = 13 Nov 23:59.
Rule: all Round 3 code is written inside the window. This file is planning, which is allowed beforehand.
Judged on (from our notes): Completeness 25 · Improvements delivered 20 · Reliability 20 · Usability/real-world fit 20 · Documentation/roadmap 15.
The three improvements we promised are what Round 3 is measured against. Everything else is secondary.

---

## 1. Where we stand vs. the field (research, 12 Nov)

Teams found on the same problem (some may be from the organiser's other events; finalist status unknown):

| Project | Ahead of us on | Behind us on |
|---|---|---|
| Baton (Bramhastra, deven065) | version diff, signed SHA-256 export, "Ask the handover" Q&A, Slack/WhatsApp/Drive import, timeline, successor checklist | sign-in page in front of the demo |
| Baton (ByteStorm, Ritika-Bhati-2266) | "Keep this side" conflict resolution, append-only audit log, critical gaps block publish, **runs fully offline (no AI key)**, 90-second judge path | no real LLM; ~9 pages of commits |
| Handover (aayush-as69) | 190 commits, CI badge, immutable claim versions, releases + acknowledgement | **demo needs a password** |
| Handover Ledger (PanavCodes) | 4 personas no login, SHA-256 audit chain, "leak canary" permission test suite | local run focus |
| Sanchaya (Epsilum) | bus-factor risk map, 7-point readiness checklist | live link 404 on 12 Nov |

Our edge: real LLM pipeline with code-checked quotes + second support check, lead-only separate pass, no-login live link that loads fast, 37 browser + 27 API tests, honest limitations.
Our gaps: (a) live behaviour depends on Gemini free quota; (b) conflicts can only be resolved/deferred, not picked side-by-side with history; (c) "unclear" flags go nowhere actionable; (d) audit log is not tamper-evident and does not record views/exports; (e) no real login; (f) no Q&A for the successor; (g) diff is basic.

---

## 2. Scope (in priority order)

### P0 — Reliability foundation (hours 0–8, Pawan)
Not a promised improvement, but "Reliability under normal use" is 20 points and every competitor that runs offline beats us here.
- **Deterministic fallback extractor**: when Gemini fails/quota is out, a rule-based extractor (commit/PR/issue/notes patterns + topic keys) still produces claims, marked with their method. Verification (quote match) is unchanged; nothing becomes Verified without the support check, so fallback claims stay Inferred unless quote+rule support passes.
- **Provider health surfaced in UI**: "AI: live / fallback" chip on the reconstruct page.
- **Fix the known Round 2 bugs**: duplicate Render-vs-Vercel conflict cards (merge by topic+side); version counter inflation; README claim showing ingest date instead of commit date; redundant gap question; "Project in five lines" picking trivia (rank by type and topic weight).
- Acceptance: kill the Gemini key locally → full flow still reaches Publish; Round 2 e2e still green.

### Improvement 1 — Cross-source conflict resolution (Pawan backend hrs 4–24, Rahul UI hrs 8–28)
- Project-wide contradiction detection across sources and time: group claims by entity/topic key, compare across sources (README vs commits vs chat vs notes), include dates; flag **staleness** ("newer source contradicts older doc").
- **Side-by-side resolution screen**: both sides with evidence quotes, source, author, date; actions: *Keep A*, *Keep B*, *Both true (scoped)*, *Neither — write correction*, *Defer to successor*. Resolution writes a Confirmed claim citing the chosen evidence + reviewer note.
- **Resolution history** per conflict (who, when, choice, note), visible in the audit log and in the successor's "Still unresolved" section when deferred.
- Publish gate: unresolved conflicts block publish (already) — now with a count per severity.
- Acceptance: the planted Render/Vercel conflict appears once, resolves via "Keep B (Vercel, commits since 2 Oct)", history shows it, successor sees the resolved claim citing the commit.

### Improvement 2 — Acknowledgement loop + version diff (Pawan hrs 20–40, Rahul hrs 24–48)
- "This is unclear" creates a **task** routed to reviewer and leaver (inbox on their role home with count badge); task states open → answered → closed.
- Leaver/reviewer answer → becomes new evidence (Exit Q&A) or an edited claim → **new handover version**.
- **Version diff view**: v1 → v2 per section: added / removed / edited (before and after text), state changes, who changed it. Successor sees "What changed since you last read" banner and re-acknowledges changed sections only.
- Acceptance: successor flags section "First week" → leaver answers in inbox → reviewer republishes v2 → successor sees diff with the change highlighted and re-acknowledges.

### Improvement 3 — Sensitive-data protection (Pawan hrs 30–56, Rahul hrs 40–60)
- **Redaction review queue**: every masked span (keys, emails, phones, plus new detectors: IBAN/UPI IDs, Aadhaar-like and PAN-like patterns, private URLs) listed for the reviewer: keep masked / unmask (with reason) / mark whole unit lead-only.
- **Guest role** (read-only, public-label only, no exports) in addition to Lead / Contributor / Leaver.
- **Full audit log of views, approvals and exports**, append-only and **hash-chained** (each entry stores SHA-256 of previous) with a "Verify chain" button.
- **Real login** for non-demo use: Supabase Auth email magic link (or GitHub OAuth) with RLS enforced; the judge demo keeps one-click roles so links still open without sign-in. If auth threatens the schedule, ship it last and say so (cut rule below).
- Leak test suite ("leak canary"): planted lead-only strings must never appear for Contributor/Guest in API responses, exports or the PDF.
- Acceptance: Guest sees only public claims; lead-only canary strings absent from every Guest/Contributor response and export; chain verify passes, tampering one row fails it.

### P2 — Competitive extras (only if P0–Imp3 are green by hour 56)
- **Ask the handover**: successor asks a question; answer only from visible claims with citations; if not answerable → "Send to leaver" (creates a gap task). Reuses permission filter.
- Successor **Day 1 / Week 1 checklist** from next-action claims.
- Decision **timeline** view.
- Signed export (SHA-256 of the published version printed in the PDF footer).

### UI pass (Rahul, continuous, hrs 8–64)
- Keep the plain blue/white system. Add: role-home inboxes, conflict split view, diff view, audit chain view, Guest entry on landing.
- Judge path ≤ 90 s, written on the landing ("Try it in 5 clicks").
- Mobile 375 px and axe clean on every new screen.

---

## 3. Timeline (hours from 13 Nov 23:59)

| Hours | Pawan | Rahul |
|---|---|---|
| 0–8 | P0 fallback extractor, bug fixes, contracts for new endpoints in `docs/contracts.md` + `web/lib/types.ts` | mocks for new endpoints, conflict split-view UI on mocks |
| 8–24 | Imp 1 backend (detection, resolve actions, history) | Imp 1 UI wired to API; landing judge path |
| 24–40 | Imp 2 backend (tasks, versioning, diff) | Imp 2 UI (inboxes, diff view, re-ack) |
| **36** | **checkpoint: all three improvements reachable end to end in simple form on the live site** | |
| 40–56 | Imp 3 backend (queue, Guest, hash-chained audit, auth) | Imp 3 UI (queue, audit view, Guest) |
| 56–64 | P2 if green; leak canary suite; deploy | e2e for all new flows; phone test; screenshots |
| 64–70 | docs: report PDF, testing notes, limitations, roadmap, contributions; demo video | demo video, final UI fixes |
| 70–72 | **submit (target hour 68)**; incognito check of every link | |

## 4. Cut rules
Cut in this order if behind: P2 extras → real login (keep Guest + role checks, disclose) → new PII detectors beyond the Round 2 set → diff on section level instead of claim level.
**Never cut:** the three improvements in at least working simple form, citations, evidence states, review/approval, the permission filter, a no-login judge path.

## 5. Round 3 submission checklist (expected; confirm when the official form is posted)
- Live link (no sign-in) · public repo · updated project PDF on Drive (anyone with link)
- Completed-improvements list with evidence (screenshots + where in the app)
- Technical details · testing notes (journeys, failure cases incl. Gemini down, permissions, reliability)
- Privacy / security / accessibility / responsible-design explanation
- Known limitations · realistic roadmap · team contributions (Pawan, Rahul)
- Demo video or live demo (2–3 min, judge path)

## 6. Prep allowed before the window (no product code)
- This plan; contracts for new endpoints written as **documentation**; UI sketches; test scenarios; demo-video script; report outline.
- Make sure Render, Supabase, Gemini key and UptimeRobot are all live at hour 0.
