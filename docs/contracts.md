# API contracts

Data shapes: see `web/lib/types.ts` (authoritative; the API's Pydantic models in `api/app/models.py` mirror it).


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
| POST /handovers/{id}/sources/upload | lead | multipart: `type` (chat_export zip | notes .md/.txt/.pdf), `file`, optional `label`; returns a Source (status ok/partial/failed + reason) |
| GET /handovers/{id}/audit | lead | `[{at, actor, action, summary, claim_id}]`, newest first |
| POST /handovers/{id}/reset | lead | demo only: restores the stored reconstruction and clears review work, answers, acknowledgements |
| POST /demo/snapshot?hid= | lead | saves the current claims/conflicts/gaps as the stored run |
| POST /demo/seed | any | creates `h_1` with sample sources incl. the CampusKart GitHub repo (idempotent) |

`POST /handovers/{id}/reconstruct`: for a handover that has a stored run (the demo `h_1`) it replays that run (no model call, protects free-tier quota); add `?live=true` to force the live pipeline. Handovers without a stored run always run the live pipeline.

## Known limitations (kept honest)
- Role comes from a header, not a verified login yet.
- `POST /sources` supports sample sources only; file upload and live GitHub connection are not wired yet.
- Model quality: the model can produce near-duplicate or over-eager claims; duplicates are merged and nothing is shown as Verified unless the quote check and the support check both pass.

---

## Round 3 contract (supersedes the Round 2 rows above where they differ)
Roles: `lead | contributor | leaver | guest` (guest reads public-labelled evidence only, cannot ack/export/raise tasks).
Hidden things return **404**, never 403-with-details. All decisions, views and exports go to the hash-chained audit log.

**Handover** adds: `revision` (draft edit counter), `leaver_available`, `is_demo`. `version` = latest **published**
version (0 = never published). `status`: `in_review` while a draft is being edited, `published` when the latest
version has no unpublished changes.

**Demo copies:** `POST /demo/sandbox` → `{handover_id: "h_demo_xxxxxxxx"}` (≈ 5–10 s on free hosting). Store it in
localStorage and use it for every role; `GET /handovers?include=<id>` lists it. `POST /handovers/{id}/reset` (lead) works
on the template and on demo copies and returns the judge-safe start: **v1 published**, conflicts deferred, one gap open,
one successor question already answered by the leaver.

| Method / path | Who | Body / response |
|---|---|---|
| GET /handovers/{id}/view?version=&draft=1&as= | all (draft/as: lead) | `{handover, version, draft, not_published, sha256, published_at, sections:[{key,title,claims,ack,carried_over,changed}], hidden_count, last_ack_version, versions:[int], viewing_as}` — reads the **published snapshot** |
| POST /handovers/{id}/ack | contributor | `{section, status: acknowledged|unclear|none, note?}` → `{ok, version, task?}`; 400 before first publish; `unclear` creates a task |
| GET /handovers/{id}/versions | all (guest: latest) | `{published:[{version,published_at,published_by,sha256,summary}], draft: {revision,status,log:[{revision,at,actor,action,summary,claim_id}]} | null}` (draft for lead only) |
| GET /handovers/{id}/versions/{a}/diff/{b} | all (b=0 → draft, lead) | `{from,to,added:[Claim],removed:[Claim],changed:[{claim_id,section,fields:{f:{before,after}},before,after,new_evidence}],sections_changed:[key],no_longer_visible:int}` role-filtered |
| POST /handovers/{id}/publish | lead | → `{ok, version, sha256}`; 400 with reasons (open conflicts, pending claims, pending people-sensitive privacy items, or nothing changed) |
| GET /handovers/{id}/conflicts | lead (others: only fully visible) | Conflict + `kind: value|staleness|ownership`, `severity`, `entity_key`, `detected_by`, `resolution: open|kept|both_true|corrected|deferred`, `resolution_claim_id`, `decided_at`, `label`, `sides:[{claim, evidence:[{evidence_id,source_name,source_type,author,ts,quote,locator}]}]` |
| POST /conflicts/{id}/resolve | lead | `{action: keep|both_true|correct|defer|reopen, keep_claim_ids?, scope_note?, corrected_statement?, note}` — note ≥10 chars (defer: optional); 409 if already settled (reopen first). Old `{resolution: resolved|unresolved_followup}` still accepted |
| GET /conflicts/{id}/history | lead | `[{at, actor, action: detected|kept|both_true|corrected|deferred|reopened, note, payload}]` |
| GET /handovers/{id}/tasks?status= | lead all · leaver assigned · contributor own | `[Task]` Task = `{id,kind: unclear_flag|successor_question|conflict_followup,section,claim_id,text,raised_by,raised_role,assigned_to: leaver|lead|both,status: open|answered|resolved|wont_fix,answer,answer_by,answer_evidence_id,resolution_note,version_raised,version_resolved,created_at,updated_at}` |
| POST /handovers/{id}/tasks | contributor | `{kind: unclear_flag|successor_question, section?, claim_id?, text(≥5)}` |
| POST /tasks/{id}/answer | leaver, lead | `{answer}` → Task (answer stored as Exit Q&A evidence; secrets → 400) |
| POST /tasks/{id}/resolve | lead | `{action: attach|new_claim|resolve|wont_fix, claim_id?, statement?, note}` → Task |
| GET /handovers/{id}/notifications | all | `{version, status, items:[{key,label,count,tab}]}` — counts for the bell / role home |
| GET /handovers/{id}/gaps?with_evidence=1 | lead, leaver, contributor (filtered) | Gap + `evidence:[{id,author,ts,locator,source_name,text}]` (redacted, role-readable only) |
| GET /handovers/{id}/audit?action=&actor= | lead | `[{seq,at,actor,role,action,summary,target_type,target_id,claim_id}]` newest first; actions include `view_handover`, `view_evidence`, `export`, `publish`, `ack`, `flag_unclear`, `answer_task`, `resolve_task`, `resolve_conflict`, … |
| GET /handovers/{id}/audit/verify | lead | `{ok, entries, broken_at, head?}` |
| GET /handovers/{id}/audit.csv | lead | CSV |
| POST /handovers/{id}/exports | all but guest | `{format, version?}` → `{version, sha256, exported_at}` — call before every export and print the hash on it |
| GET /handovers/{id}/readiness | lead | adds `deferred_conflicts` |
| GET /jobs/{id} | lead | |
Claim adds `method: model|rules|human`; `review_status` adds `superseded` (lost a conflict decision; hidden from non-leads).
Evidence unit adds `flags` (e.g. `possible_injection`). Coming next (shapes to be added here): redaction queue, rules-mode indicator.

**Privacy queue (Improvement 3, lead only)**
| Method / path | Body / response |
|---|---|
| GET /handovers/{id}/redactions?status= | `{items:[{id,evidence_id,detector,detector_name,kind: secret|pii|manual|suggestion,preview,decision: pending|keep_masked|unmask|escalate_lead_only|added_manual,decided_by,decided_at,reason,source_name,source_id,label,author,ts,locator}], counts:{decision:n}}` — `preview` is masked context; raw values are never sent |
| POST /redactions/{id}/decide | `{decision: keep_masked|unmask|escalate_lead_only|dismiss, reason}` — reason ≥5 chars except keep_masked; secrets cannot be unmasked; `escalate_lead_only` relabels the passage and every claim citing it |
| POST /evidence/{id}/redact | `{start, end, reason}` manual mask |
Pending `people_sensitive` suggestions block publishing. Secrets enter the queue already decided (`keep_masked`).

**AI status:** `GET /ai/status` → `{mode: auto|model|rules, model_configured, calls:{model,rules}, recent_errors}`. Claims made without AI have `method: "rules"`.
