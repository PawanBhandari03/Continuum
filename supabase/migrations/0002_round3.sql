-- Continuum Round 3 schema changes. Idempotent: safe to run more than once.
-- Design: docs/round3/00_INDEX.md (data model summary) and specs 02-05.

-- ---------- handovers: published version vs draft revision ----------
alter table handovers add column if not exists revision int not null default 1;
alter table handovers add column if not exists leaver_available boolean not null default true;
alter table handovers add column if not exists template_id text;          -- set on per-visitor demo copies
-- version now means "latest published version" (0 = never published)
alter table handovers alter column version set default 0;

-- ---------- claims ----------
alter table claims add column if not exists method text not null default 'model';  -- model | rules | human
alter table claims drop constraint if exists claims_review_status_check;
alter table claims add constraint claims_review_status_check
  check (review_status in ('pending','approved','edited','rejected','redacted','superseded'));

-- ---------- evidence ----------
alter table evidence_units add column if not exists flags jsonb not null default '[]';
alter table sources drop constraint if exists sources_type_check;
alter table sources add constraint sources_type_check
  check (type in ('github','chat_export','notes','issues','exit_qa'));

-- ---------- conflicts (Improvement 1) ----------
alter table conflicts add column if not exists entity_key text not null default '';
alter table conflicts add column if not exists kind text not null default 'value';           -- value | staleness | ownership
alter table conflicts add column if not exists severity text not null default 'blocking';    -- blocking | warning
alter table conflicts add column if not exists detected_by text not null default 'model';    -- rules | model | rules+model
alter table conflicts add column if not exists resolution_claim_id text;
alter table conflicts add column if not exists decided_at timestamptz;
alter table conflicts add column if not exists label text not null default 'contributor';
alter table conflicts drop constraint if exists conflicts_resolution_check;
update conflicts set resolution = 'kept' where resolution = 'resolved';
update conflicts set resolution = 'deferred' where resolution = 'unresolved_followup';
alter table conflicts add constraint conflicts_resolution_check
  check (resolution in ('open','kept','both_true','corrected','deferred'));

create table if not exists conflict_events (
  id uuid primary key default gen_random_uuid(),
  conflict_id text not null,
  handover_id text not null references handovers(id) on delete cascade,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,           -- detected | kept | both_true | corrected | deferred | reopened
  payload jsonb not null default '{}',
  note text
);
create index if not exists conflict_events_cf on conflict_events(conflict_id);

-- ---------- published versions (Improvement 2 foundation) ----------
create table if not exists handover_versions (
  handover_id text not null references handovers(id) on delete cascade,
  version int not null,
  published_at timestamptz not null default now(),
  published_by text not null,
  snapshot jsonb not null,
  sha256 text not null,
  summary jsonb not null default '{}',
  primary key (handover_id, version)
);

-- ---------- tasks: unclear flags and successor questions ----------
create table if not exists tasks (
  id text primary key,
  handover_id text not null references handovers(id) on delete cascade,
  kind text not null check (kind in ('unclear_flag','successor_question','conflict_followup')),
  section text,
  claim_id text,
  text text not null,
  raised_by text not null,
  raised_role text not null,
  assigned_to text not null default 'both' check (assigned_to in ('leaver','lead','both')),
  status text not null default 'open' check (status in ('open','answered','resolved','wont_fix')),
  answer text,
  answer_by text,
  answer_evidence_id text,
  resolution_note text,
  version_raised int not null default 0,
  version_resolved int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_h on tasks(handover_id);

-- ---------- acknowledgements per published version ----------
alter table acknowledgements add column if not exists version int not null default 0;
alter table acknowledgements add column if not exists carried_over boolean not null default false;
alter table acknowledgements drop constraint if exists acknowledgements_pkey;
alter table acknowledgements add constraint acknowledgements_pkey primary key (handover_id, section, actor, version);

-- ---------- redaction review queue (Improvement 3) ----------
create table if not exists redaction_reviews (
  id text primary key,
  handover_id text not null references handovers(id) on delete cascade,
  evidence_id text not null,
  start_pos int not null,
  end_pos int not null,
  detector text not null,
  kind text not null,
  preview text not null,          -- masked context only; never the raw value
  decision text not null default 'pending'
    check (decision in ('pending','keep_masked','unmask','escalate_lead_only','added_manual')),
  decided_by text,
  decided_at timestamptz,
  reason text
);
create index if not exists redaction_reviews_h on redaction_reviews(handover_id);

-- ---------- tamper-evident audit log (Improvement 3) ----------
create table if not exists audit_log (
  seq bigserial primary key,
  handover_id text not null,
  at timestamptz not null default now(),
  actor text not null,
  role text not null default '',
  action text not null,
  target_type text,
  target_id text,
  summary text not null default '',
  meta jsonb not null default '{}',
  prev_hash text not null,
  hash text not null
);
create index if not exists audit_log_h on audit_log(handover_id, seq);

create or replace function audit_log_guard() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('continuum.audit_reset', true), '') = 'on' then
    return old;   -- only reachable through audit_reset() below
  end if;
  raise exception 'audit_log is append-only';
end $$;
drop trigger if exists audit_log_no_change on audit_log;
create trigger audit_log_no_change before update or delete on audit_log
  for each row execute function audit_log_guard();

-- Demo reset is the only path that may clear a handover's log; the reset itself is then logged as the new first entry.
create or replace function audit_reset(hid text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('continuum.audit_reset', 'on', true);
  delete from audit_log where handover_id = hid;
  perform set_config('continuum.audit_reset', 'off', true);
end $$;
revoke all on function audit_reset(text) from public, anon, authenticated;

-- ---------- roles: add guest (reads public only) ----------
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('lead','contributor','leaver','guest'));
create or replace function app_role_rank() returns int
language sql stable security definer set search_path = public as
$$ select case coalesce(app_role(), 'none') when 'lead' then 2 when 'contributor' then 1 when 'leaver' then 1 when 'guest' then 0 else -1 end $$;

-- ---------- RLS on new tables (API uses the service role; these protect direct access) ----------
alter table conflict_events enable row level security;
alter table handover_versions enable row level security;
alter table tasks enable row level security;
alter table redaction_reviews enable row level security;
alter table audit_log enable row level security;
drop policy if exists versions_read on handover_versions;
create policy versions_read on handover_versions for select using (app_role_rank() >= 0);
drop policy if exists tasks_read on tasks;
create policy tasks_read on tasks for select using (app_role_rank() >= 1);
drop policy if exists audit_lead_read on audit_log;
create policy audit_lead_read on audit_log for select using (app_role() = 'lead');
drop policy if exists redactions_lead_read on redaction_reviews;
create policy redactions_lead_read on redaction_reviews for select using (app_role() = 'lead');
drop policy if exists cf_events_lead_read on conflict_events;
create policy cf_events_lead_read on conflict_events for select using (app_role() = 'lead');
