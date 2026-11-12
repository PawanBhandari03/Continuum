# Draft of the final README (structure modelled on the organiser's winning repos)

Use at hour 62–68. Replace every `[[…]]` with real, checked facts. Delete any row that did not ship. Do not publish
claims about features that are not live. Text that is already true today is written out in full.

---

# Continuum
### Project handovers that show their work.

**Live demo (no sign-in, works without an AI key):** https://continuum-web-kodb.onrender.com · **Project PDF:** [[Drive link]] · **Demo video:** [[link]]

Team **BINARY BUILDERS** · CodeFrontier 2026, Problem 01: *Prevent Critical Knowledge From Leaving With People*
Pawan Singh Bhandari (backend, AI) · Rahul Bramhankar (frontend, design, testing)

## Try it in 5 minutes (judge's tour)
Open the link → **Enter the demo** (you get your own copy; nothing you do affects other visitors) → follow the
**Judge's tour** in the top bar. Each step switches role for you.

| Step | As | Do | You will see |
|---|---|---|---|
| 1 | Reviewer | Conflicts → keep the Vercel side, write a reason | one disagreement, both sources with dates, history entry |
| 2 | Reviewer | Privacy → review masked items → Publish v1 | PAN/Aadhaar/key masked, publish blocked until decided |
| 3 | Successor | Read, flag "Your first week" as unclear | task sent to the leaver and reviewer |
| 4 | Leaver | Answer it | answer stored as citable evidence |
| 5 | Reviewer | Tasks → attach answer → Publish v2 | new signed version |
| 6 | Successor / Guest | "What changed since you read" → re-acknowledge; Guest sees the public subset | diff with before/after; hidden-item count |
[[Adjust to what shipped.]]

## What makes it more than an AI summary
| Judging need | How Continuum handles it | Where to see it |
|---|---|---|
| Completeness (the 5-step workflow) | Connect → Reconstruct → Verify → Review → Handover, end to end | [[screens]] |
| Improvement 1: cross-source conflicts | [[shipped description]] | Conflicts tab |
| Improvement 2: acknowledgement loop + version diff | [[shipped description]] | Start here, Tasks |
| Improvement 3: sensitive-data protection | [[shipped description]] | Privacy, Activity |
| Reliability | Rules fallback when AI is unavailable; frozen hashed versions; [[N]] automated tests in CI | [[links]] |
| Usability | No sign-in, guided tour, 375 px, axe clean; [[N]] real people tried it unaided | docs/testing.md |
| Trust | Every claim cites a quote checked by code; uncertain claims labelled; humans decide every disagreement | evidence drawer |
| Privacy | Permission before generation; hidden items as counts; India-aware PII detection; tamper-evident log | Privacy, Activity |

## Evidence states
(keep the Round 2 table)

## Architecture
(Mermaid diagrams from the current README, updated: rules fallback, snapshots, tasks, audit chain)

## Implementation status
| Feature | Status |
|---|---|
| [[each feature]] | Implemented · Partially implemented · Not verified · Not implemented |
Only list "Implemented" if it was clicked through on the live site and has a test.

## Testing (only runs we executed)
| Check | Result | Date |
|---|---|---|
| API unit tests | [[x/x]] | [[date]] |
| Leak canary (all endpoints × 3 roles) | [[x/x]] | |
| Browser end-to-end (mock) | [[x/x]] | |
| Live judge path | [[pass/fail]] | |
| Planted facts, AI mode / rules mode | [[x/8]] / [[x/8]] | |
| Accessibility (axe) | [[0 violations on N screens]] | |
| Usability sessions | [[N people, median time, top issues]] | |

## Run locally · Configuration · Deployment
(keep current sections)

## Known limitations
[[honest list]]

## Roadmap
[[from 08 §D]]

## Disclosure (AI tools, services, libraries, licences)
(keep current section, add anything new)
