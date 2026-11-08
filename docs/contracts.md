# API contracts

Data shapes: see `web/lib/types.ts` (authoritative; the API's Pydantic models in `api/app/models.py` mirror it).
Section 6 of `HANDOFF_FOR_RAHUL.md` explains the semantics.

## Running the API
```
cd api
python -m venv .venv && .venv\Scripts\pip install -r requirements.txt
copy ..\.env.example .env      # fill SUPABASE_*, GEMINI_API_KEY (never commit)
.venv\Scripts\uvicorn app.main:app --port 8000
```
Seed the CampusKart demo handover (`h_1`): `POST /demo/seed`, then `POST /handovers/h_1/reconstruct` as lead.

## Auth (demo)
Send the viewer's role in the `X-Demo-Role` header: `lead` | `contributor` | `leaver` (default `contributor`).
The API derives the actor name from the role. Supabase JWT auth is a later hardening step.

## Endpoints (all JSON)
| Method + path | Who | Notes |
|---|---|---|
| GET /health | any | |
| GET/POST /handovers, GET /handovers/{id} | any | |
| GET /handovers/{id}/sources | any | lead-only sources are not listed for other roles |
| POST /handovers/{id}/sources | any | body `{type, name, ref?, sample?}`; `sample:true` loads CampusKart |
| POST /handovers/{id}/reconstruct | lead | returns `{job_id}`; runs in background |
| GET /jobs/{id} | any | `{status, stage, progress, error}`; `error` also reports partial model failures |
| GET /handovers/{id}/claims?state=&type=&workstream=&review_status= | any | role-scoped |
| PATCH /claims/{id} | lead | `{action: approve|edit|reject|redact|mark_sensitive, edited_statement?, note?}` |
| GET /claims/{id}/evidence | any | 403 if the role cannot see the claim; secrets/PII always masked |
| GET /handovers/{id}/conflicts, POST /conflicts/{id}/resolve | lead (resolve) | `{resolution: resolved|unresolved_followup, note, keep_claim_id?}` |
| GET /handovers/{id}/gaps, POST /gaps/{id}/answer | lead/leaver (answer) | `{answer}` or `{answer:"", skip:true}`; answers become Exit Q&A evidence |
| GET /handovers/{id}/readiness | any | |
| GET /handovers/{id}/versions | any | newest first |
| POST /handovers/{id}/publish | lead | 400 with the reasons if blocked |
| GET /handovers/{id}/view | any | role-scoped; `hidden_count` is a count only |
| POST /handovers/{id}/ack | any | `{section, status: acknowledged|unclear|none, note?}` |
| POST /demo/seed | any | creates `h_1` with sample sources (idempotent) |

## Known limitations (kept honest)
- Role comes from a header, not a verified login yet.
- `POST /sources` supports sample sources only; file upload and live GitHub connection are not wired yet.
- Model quality: the model can produce near-duplicate or over-eager claims; duplicates are merged and nothing is shown as Verified unless the quote check and the support check both pass.
