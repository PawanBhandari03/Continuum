-- Round 3: project title and metadata for the demo project catalog (team, stack, description). Idempotent.
alter table handovers add column if not exists title text;
alter table handovers add column if not exists meta jsonb not null default '{}';
