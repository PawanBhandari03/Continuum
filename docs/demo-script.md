# Demo script (what the product really does today)

Live site: https://continuum-web-kodb.onrender.com (no sign-in). The demo project is the fictional **CampusKart**; Aditi is leaving and Karan takes over. A guided tour appears on the first visit (Help button reopens it).

**Before you start**
- Open the site 2 minutes early: free hosting sleeps and the first load can take up to a minute (a "Waking the server" banner shows). 
- If the demo handover was already published or changed, it needs resetting. There is no Reset button on the live site (it exists only in local mock mode); Pawan can reset it with `POST /handovers/h_1/reset` (header `X-Demo-Role: lead`), which restores the stored run (94 claims, version 1).
- **Known limitation to say out loud, not hide:** on the free hosting each approval takes about 6 to 10 seconds, and the demo handover has 94 claims, so approving everything on the live site takes many minutes. For a live demo, either approve a few claims and explain the rest, or run the full flow locally in mock mode (`cd web && npm install && npm run dev`, which loads 19 claims and runs the whole path in seconds). See `docs/testing.md`.

## 3-minute walkthrough (live site)
1. **The idea (20 s).** "When someone leaves, their knowledge leaves with them. Continuum rebuilds the project's state from the repo, chat, notes and issues, and every statement shows its source and how sure we are."
2. **Enter as Reviewer (10 s).** Click "Enter as Reviewer", open the CampusKart handover. Point at the tabs: Connect, Reconstruct, Verify & review, Conflicts, Gap Interview, Review activity, Start here.
3. **Claim ledger (40 s).** Show the readiness score and click "How is this calculated?" (formula visible). Point at the state badges: **Verified**, **Inferred** ("AI inference, not stated in any source"), **Conflicting**. Note that Publish is disabled and says why.
4. **Prove a claim (25 s).** Click a source chip, for example "PR #87" or "#payments". The original text opens with the cited quote highlighted. Press Esc.
5. **Conflicts (25 s).** Open Conflicts: README says Render, commits configure Vercel. "We never pick the newest." Either select a side and write a note, or press "Mark unresolved, successor to follow up". (The demo data shows the same disagreement twice; resolve both.)
6. **Gap Interview (25 s).** Switch role (top right) to **Leaver**. "Only what the evidence can't answer": for example who owns the college SMTP account. Type a short answer and save; it becomes new evidence ("Exit Q&A").
7. **Approve and publish (20 s).** Back as Reviewer, use "Approve all Verified claims" and "Approve all remaining" (slow on the free hosting, see above). When conflicts are handled and claims reviewed, "Approve and publish" locks the version.
8. **Successor (25 s).** Switch to **Successor**. Show the seven sections, state badges and source chips, and the lock badge "N items hidden by your access level" (a count, never the content: the mentor's private note and its fake key never appear). Press "I have read this" on one section and "This is unclear" on another.
9. **Close (10 s).** "Review activity" shows who did what; "Export as Markdown / Print" gives the handover with citations. "Every claim cites its source, uncertainty is labelled, a person approves, and each role sees only what it may."

## 1-minute version
1. Enter as Reviewer, open the ledger: point at the readiness score and the badges (Verified, Inferred, Conflicting). (15 s)
2. Click a source chip: original text, quote highlighted. (10 s)
3. Conflicts: show Render vs Vercel, both sides, nothing auto-picked. (10 s)
4. Switch to Successor: hidden-count badge, source chips, "I have read this". (15 s)
5. One sentence: "Handovers that show their work: cited, labelled, approved by a person, permission-aware." (10 s)

## Questions judges may ask (answers that are true today)
- **Is the login real?** No. Roles are chosen in the UI and sent in a header so judges need no sign-in. Row-level-security policies exist in the database; the demo relies on the API's role checks.
- **Does it always get facts right?** No. In one measured run it found 7 of the 8 planted facts, and every shown claim had a citation (`docs/evaluation.md`). Model output varies between runs; a person must approve before publishing.
- **Is the AI hallucination-proof?** No. Free text from the model is rejected, citations are checked by code and a second check, and uncertain claims are labelled. "Verified" needs both checks.
- **What does it not do yet?** Real login, a Guest role, a redaction queue, logging of views and exports, a version-diff endpoint on the server, Trello/DOCX import.
