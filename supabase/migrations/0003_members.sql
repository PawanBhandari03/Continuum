-- Continuum Round 3: real accounts (Supabase Auth) with per-handover membership, enforced by row-level security.
-- Idempotent. Demo handovers have no members and keep the one-click demo roles; a handover WITH members can only be
-- opened by its signed-in members, and the database itself filters what each member may read.

create table if not exists handover_members (
  handover_id text not null references handovers(id) on delete cascade,
  email text not null,
  user_id uuid references auth.users(id) on delete set null,   -- filled the first time the invited person signs in
  role text not null check (role in ('lead','contributor','leaver','guest')),
  invited_by text,
  created_at timestamptz not null default now(),
  primary key (handover_id, email)
);
create index if not exists handover_members_user on handover_members(user_id);

-- Role of the signed-in user in one handover (null if not a member).
create or replace function member_role(hid text) returns text
language sql stable security definer set search_path = public as
$$ select role from handover_members
   where handover_id = hid
     and (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
   limit 1 $$;

create or replace function member_rank(hid text) returns int
language sql stable security definer set search_path = public as
$$ select case coalesce(member_role(hid), 'none')
     when 'lead' then 2 when 'contributor' then 1 when 'leaver' then 1 when 'guest' then 0 else -1 end $$;

alter table handover_members enable row level security;
drop policy if exists members_read on handover_members;
create policy members_read on handover_members for select using (member_rank(handover_id) >= 0);

-- Content tables: what a member may read is decided here, in the database, not only in the API.
drop policy if exists handovers_read on handovers;
create policy handovers_read on handovers for select using (member_rank(id) >= 0);

drop policy if exists sources_read on sources;
create policy sources_read on sources for select
  using (label_rank(default_label) <= member_rank(handover_id));

drop policy if exists evidence_read on evidence_units;
create policy evidence_read on evidence_units for select
  using (label_rank(label) <= member_rank(handover_id));

drop policy if exists claims_read on claims;
create policy claims_read on claims for select using (
  label_rank(label) <= member_rank(handover_id)
  and (member_role(handover_id) = 'lead'
       or (not sensitive and review_status not in ('rejected', 'redacted', 'superseded')))
);

drop policy if exists conflicts_read on conflicts;
create policy conflicts_read on conflicts for select using (member_rank(handover_id) >= 1);
drop policy if exists gaps_read on gaps;
create policy gaps_read on gaps for select using (member_rank(handover_id) >= 1);
drop policy if exists versions_read on handover_versions;
create policy versions_read on handover_versions for select using (member_rank(handover_id) >= 0);
drop policy if exists tasks_read on tasks;
create policy tasks_read on tasks for select using (member_rank(handover_id) >= 1);
drop policy if exists audit_lead_read on audit_log;
create policy audit_lead_read on audit_log for select using (member_role(handover_id) = 'lead');
drop policy if exists redactions_lead_read on redaction_reviews;
create policy redactions_lead_read on redaction_reviews for select using (member_role(handover_id) = 'lead');
drop policy if exists cf_events_lead_read on conflict_events;
create policy cf_events_lead_read on conflict_events for select using (member_role(handover_id) = 'lead');
drop policy if exists ack_read on acknowledgements;
create policy ack_read on acknowledgements for select using (member_rank(handover_id) >= 1);

-- Signed-in users may read through these tables; all writes still go through the API's service role after its checks.
grant select on handovers, sources, evidence_units, claims, conflicts, gaps, handover_versions, tasks, audit_log,
  redaction_reviews, conflict_events, acknowledgements, handover_members to authenticated;
