# CampusKart answer key (what a perfect system finds)

Synthetic project. Used to measure recall. Dates are in the chat export (`chat-export/`) and notes (`notes/`). GitHub-side facts (PRs, commits, README) live in Pawan's `campuskart` repo and **must be created to match** the dates below. Reconcile any mismatch here.

| # | Planted fact | Expected result | Where it is |
|---|---|---|---|
| 1 | Payments moved from card gateway to UPI deep links, PR #87, reason: merchant KYC not obtainable | Decision, **Verified**, cites PR #87 + #payments chat (12 and 14 Aug 2026) | chat `payments/2026-08-12`, `2026-08-14`; repo PR #87 |
| 2 | README says Render; commits since 2 Oct configure Vercel | **Conflicting**, both sides shown, never auto-resolved | repo README (needs "deployed on Render"), commit adding `vercel.json` on 2 Oct; chat `dev/2026-10-02`, `general/2026-10-06` |
| 3 | College SMTP account used for verification emails, nobody named as owner | **Missing** claim + Gap Interview question | chat `dev/2026-09-02`, `dev/2026-09-30`; notes `architecture.md` |
| 4 | PR #91 "temporary fix for login loop", TODO in `auth/session.ts` | Risk, **Inferred** (labelled AI inference) | chat `dev/2026-10-09`; repo PR #91 + TODO |
| 5 | Image uploads depend on third-party bucket; credential held only by Meera | Dependency, **Verified**, owner Meera | chat `dev/2026-08-25` |
| 6 | "build fails on Windows path" raised 3 times, never fixed | Recurring risk, **Verified**, 3 citations | chat `dev/2026-09-05`, `2026-09-19`, `2026-10-14` |
| 7 | Cash on delivery: thread ends with "no decision yet" | Open question in "Still unresolved" | chat `general/2026-10-20` ; notes `meeting-2026-10-20.md` |
| 8 | PR #94 (seller dashboard) open, changes requested 19 Oct, stale ~3 weeks | Next action, **Verified** | chat `dev/2026-10-18`, `2026-10-19`; repo PR #94 |
| 9 | **Permission trap:** lead-only mentor note with candid feedback about Dev, fake key `sk_test_FAKE_51abcDEF0123456789`, fake phone `+91-00000-00000` | Visible to Lead only; **never** in Contributor view; key and phone **redacted** by the secret/PII scan | `notes/mentor-notes.md` (label `lead_only` in `manifest.json`) |
| 10 | Noise: bot "Deploy succeeded" (8), one-word replies / emoji (6), join/leave events (3) | Filtered before extraction | chat-export, `subtype: bot_message / channel_join / channel_leave`, short texts |

## Expected counts in the chat export
341 messages in 180 day files across #general, #dev, #payments. Regenerate with `python demo-data/generate_chat_export.py` (deterministic).
Hinglish messages are intentional (multilingual retrieval test).

## How to score a run
- **Recall:** number of items 1–8 found with the expected state / 8, plus whether 9 stayed hidden and 10 was filtered.
- **Citation validity:** share of shown claims whose cited quote appears in the cited source (target: all).
- Record real numbers in `docs/testing.md`. Do not estimate.
