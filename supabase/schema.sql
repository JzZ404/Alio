-- Alio — Supabase schema
-- Run once in: Supabase Dashboard → SQL Editor → paste → Run
--   (or via the VSCode Supabase extension's SQL panel,
--    or `npx supabase db push` if your project is linked locally)

-- =============================================================
-- caregiver_logs — one row per voice log the caregiver records
-- =============================================================
create table if not exists caregiver_logs (
  id uuid primary key default gen_random_uuid(),
  caregiver_id text not null,
  patient_id text not null,
  visit_date date not null default current_date,
  transcript text not null,
  summary text,
  mood text,
  medications_noted text[] default '{}',
  urgent boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists caregiver_logs_lookup_idx
  on caregiver_logs (caregiver_id, patient_id, visit_date desc);

-- =============================================================
-- family_messages — chat thread between caregiver and family
-- =============================================================
create table if not exists family_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id text not null,
  sender text not null,
  text text not null,
  report_id uuid,
  created_at timestamptz not null default now()
);

-- For existing projects: add the report_id column if the table was created
-- before this column existed. NOOPs on fresh setups.
alter table family_messages
  add column if not exists report_id uuid;

create index if not exists family_messages_thread_idx
  on family_messages (thread_id, created_at);

-- Enable Postgres LISTEN/NOTIFY so the family app can subscribe in realtime
alter publication supabase_realtime add table family_messages;

-- =============================================================
-- compiled_reports — structured visit reports filled in by Gemma
--                    (the data behind the "Dorothy's Report" card)
-- =============================================================
create table if not exists compiled_reports (
  id uuid primary key default gen_random_uuid(),
  caregiver_id text not null,
  patient_id text not null,
  patient_name text not null,
  visit_date date not null,
  visit_time text,
  report jsonb not null,
  source_log_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists compiled_reports_lookup_idx
  on compiled_reports (caregiver_id, patient_id, visit_date desc);

-- =============================================================
-- Row-level security — anon key can read/insert from the browser
-- (Prototype policy. Tighten once real auth lands.)
-- =============================================================
alter table caregiver_logs    enable row level security;
alter table family_messages   enable row level security;
alter table compiled_reports  enable row level security;

create policy "caregiver_logs anon read"   on caregiver_logs  for select using (true);
create policy "caregiver_logs anon insert" on caregiver_logs  for insert with check (true);

create policy "family_messages anon read"   on family_messages for select using (true);
create policy "family_messages anon insert" on family_messages for insert with check (true);

create policy "compiled_reports anon read"   on compiled_reports for select using (true);
create policy "compiled_reports anon insert" on compiled_reports for insert with check (true);
