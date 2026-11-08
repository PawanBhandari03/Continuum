-- Continuum schema + row-level security.
-- Access labels rank: public(0) < contributor(1) < lead_only(2). Roles: lead(2), contributor(1), leaver(1).
-- The API uses the service role for the worker; user-facing reads must use the user's JWT so RLS applies.

create extension if not exists pgcrypto;

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('lead','contributor','leaver'))
);

create table if not exists handovers (
  id text primary key,
  leaver text not null,
  successor text not null,
  successor_role text not null check (successor_role in ('contributor','lead')),
  target_date date,
  status text not null default 'draft' check (status in ('draft','in_review','published')),
  version int not null default 1,
  approved_by text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists sources (
  id text primary key,
  handover_id text not null references handovers(id) on delete cascade,
  type text not null check (type in ('github','chat_export','notes','issues','exit_qa')),
  name text not null,
  status text not null default 'pending' check (status in ('ok','partial','failed','pending')),
  status_reason text,
  default_label text not null default 'contributor' check (default_label in ('public','contributor','lead_only')),
  unit_count int not null default 0
);

create table if not exists evidence_units (
  id text primary key,
  handover_id text not null references handovers(id) on delete cascade,
  source_id text not null references sources(id) on delete cascade,
  author text not null,
  ts timestamptz not null,
  text text not null,
  locator text not null,
  label text not null default 'contributor' check (label in ('public','contributor','lead_only')),
  redactions jsonb not null default '[]'
);

create table if not exists claims (
  id text primary key,
  handover_id text not null references handovers(id) on delete cascade,
  type text not null,
  statement text not null,
  state text not null check (state in ('verified','inferred','conflicting','missing','confirmed')),
  confidence_reason text not null default '',
  workstream text not null default 'general',
  entity_key text not null default '',
  owner text,
  label text not null default 'contributor' check (label in ('public','contributor','lead_only')),
  review_status text not null default 'pending' check (review_status in ('pending','approved','edited','rejected','redacted')),
  sensitive boolean not null default false,
  section text not null default 'state',
  date date,
  citations jsonb not null default '[]',   -- [{evidence_id, quote, support}]
  conflict_id text,
  version int not null default 1,
  confirmed_by text,
  confirmed_at timestamptz
);

create table if not exists conflicts (
  id text primary key,
  handover_id text not null references handovers(id) on delete cascade,
  claim_ids text[] not null,
  summary text not null,
  resolution text not null default 'open' check (resolution in ('open','resolved','unresolved_followup')),
  resolved_by text,
  note text
);

create table if not exists gaps (
  id text primary key,
  handover_id text not null references handovers(id) on delete cascade,
  claim_id text not null,
  question text not null,
  evidence_found text[] not null default '{}',
  status text not null default 'open' check (status in ('open','answered','skipped')),
  answer text,
  answer_evidence_id text
);

create table if not exists review_actions (
  id uuid primary key default gen_random_uuid(),
  handover_id text not null references handovers(id) on delete cascade,
  claim_id text,
  actor text not null,
  action text not null,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);

create table if not exists acknowledgements (
  handover_id text not null references handovers(id) on delete cascade,
  section text not null,
  status text not null check (status in ('none','acknowledged','unclear')),
  note text,
  actor text not null,
  at timestamptz not null default now(),
  primary key (handover_id, section, actor)
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  handover_id text not null references handovers(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  stage text,
  progress int not null default 0,
  error text,
  created_at timestamptz not null default now()
);

-- ---------- helpers ----------
create or replace function app_role() returns text
language sql stable security definer set search_path = public as
$$ select role from profiles where user_id = auth.uid() $$;

create or replace function app_role_rank() returns int
language sql stable security definer set search_path = public as
$$ select case coalesce(app_role(), 'none') when 'lead' then 2 when 'contributor' then 1 when 'leaver' then 1 else -1 end $$;

create or replace function label_rank(l text) returns int
language sql immutable as
$$ select case l when 'public' then 0 when 'contributor' then 1 when 'lead_only' then 2 else 99 end $$;

-- ---------- row-level security ----------
alter table profiles enable row level security;
alter table handovers enable row level security;
alter table sources enable row level security;
alter table evidence_units enable row level security;
alter table claims enable row level security;
alter table conflicts enable row level security;
alter table gaps enable row level security;
alter table review_actions enable row level security;
alter table acknowledgements enable row level security;
alter table jobs enable row level security;

create policy profiles_self on profiles for select using (user_id = auth.uid());

create policy handovers_read on handovers for select using (app_role_rank() >= 1);

create policy sources_read on sources for select
  using (app_role_rank() >= 1 and label_rank(default_label) <= app_role_rank());

-- Evidence: only units whose label the caller's role may read.
create policy evidence_read on evidence_units for select
  using (label_rank(label) <= app_role_rank());

-- Claims: label is the strictest label of its cited evidence (set by the pipeline).
-- Non-leads never see sensitive, rejected or redacted claims.
create policy claims_read on claims for select using (
  label_rank(label) <= app_role_rank()
  and (app_role() = 'lead' or (not sensitive and review_status not in ('rejected','redacted')))
  and review_status <> 'rejected'
);
create policy claims_lead_write on claims for update using (app_role() = 'lead') with check (app_role() = 'lead');

create policy conflicts_read on conflicts for select using (app_role_rank() >= 1);
create policy conflicts_lead_write on conflicts for update using (app_role() = 'lead') with check (app_role() = 'lead');

create policy gaps_read on gaps for select using (app_role_rank() >= 1);
create policy gaps_answer on gaps for update using (app_role() in ('lead','leaver')) with check (app_role() in ('lead','leaver'));

create policy actions_lead_read on review_actions for select using (app_role() = 'lead');

create policy ack_read on acknowledgements for select using (app_role_rank() >= 1);
create policy ack_write on acknowledgements for insert with check (app_role_rank() >= 1);
create policy ack_update on acknowledgements for update using (actor = (select display_name from profiles where user_id = auth.uid()));

create policy jobs_read on jobs for select using (app_role_rank() >= 1);

-- Inserts/deletes on evidence, claims, sources, jobs happen only through the API's service role
-- (service role bypasses RLS), never from the browser.
