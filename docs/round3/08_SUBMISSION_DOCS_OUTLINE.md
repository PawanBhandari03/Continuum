# 08 — Round 3 submission documents (outline now, fill with real results in the window)

Documentation and roadmap = 15 points. Judges assess what is demonstrated; every claim in these documents must point
to something visible in the product, a test result, or a file in the repo.

## A. Final report / updated project PDF (8–10 pages)
1. One-paragraph summary + live link + "how to try it in 5 minutes" (judge path from 06).
2. What changed since Round 2 (table: feature · where in the app · evidence screenshot).
3. **The three improvements delivered** — one page each: what was promised (quote the Round 2 form text exactly),
   what shipped, screenshot(s), acceptance tests that pass, what is not done and why.
4. Architecture + data flow (update the README Mermaid diagrams: add snapshots, tasks, audit chain, rules fallback).
5. Reliability: rules fallback, failure-case table results, test counts (real), CI.
6. Privacy, security, accessibility and responsible design (section C below).
7. Testing notes (from 07 §4) incl. usability sessions with real findings.
8. Known limitations (honest list).
9. Roadmap (realistic, section D).
10. Team and contributions (section E). AI-use disclosure.

## B. Completed-improvements list (form text, one line each + where to see it)
To be written from what actually ships.

## C. Privacy / security / accessibility / responsible design — points to cover
- Permission before generation (separate lead-only pass) and claim visibility = strictest label; filtered server-side;
  hidden items as counts only; hidden ids 404.
- Detectors incl. Indian identifiers, queue with human decisions, secrets refused in answers; raw secrets never leave the API.
- Frozen, hashed versions; tamper-evident audit of views/exports/approvals; signed exports.
- What AI does and does not do; rules fallback; injection guard; nothing Verified without a code check.
- Data: synthetic demo only; we do not monitor people; product runs per handover, on sources a lead attests they may share.
- Accessibility: axe results per screen, keyboard path, colour + icon + text for states, reduced motion, 375 px.
- Responsible design risks we see: performance judgements about people (people-sensitive detector, lead-only default
  suggestion), over-trust in "Verified" (we show why each state was given), stale handovers (versioning).

## D. Roadmap (realistic; label each as next 1 month / 3 months / later)
- Live Slack/Discord connectors with incremental sync; Google Drive.
- Organisation accounts, SSO, per-project membership (beyond 3e).
- Embeddings for better grouping (needs more memory than free hosting).
- Email notifications for tasks.
- Measured accuracy on 3+ real (consenting) projects; precision of conflict detection.
- Self-hosting guide; data retention controls.

## E. Contributions (each member writes their own in their own words; drafts below are prompts, not text)
- Pawan — backend/AI: which specs above, which tests, deployment.
- Rahul — frontend/design/testing: which screens, usability sessions, phone/a11y testing, demo video.

## F. Demo video (2–3 min) script outline
0:00 problem in one line → 0:15 judge path steps 1–6 → 2:15 "works without AI" toggle + audit verify → 2:40 limitations
one line + link. Record on the live site after a reset; no edits that hide failures.
