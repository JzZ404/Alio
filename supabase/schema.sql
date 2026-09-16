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
--                    (the data behind the "Erin's Report" card)
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
-- patients — patient profile: name, medications, appointments
-- =============================================================
create table if not exists patients (
  id text primary key,               -- e.g. 'erin-yeung'
  name text not null,
  medications jsonb not null default '[]',
  appointments jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create policy "patients anon read" on patients for select using (true);
create policy "patients anon insert" on patients for insert with check (true);
create policy "patients anon update" on patients for update using (true);

alter table patients enable row level security;

-- =============================================================
-- ai_chat_history — family AI chatbot conversation turns
-- =============================================================
create table if not exists ai_chat_history (
  id uuid primary key default gen_random_uuid(),
  patient_id text not null,
  role text not null check (role in ('user', 'model')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_history_lookup_idx
  on ai_chat_history (patient_id, created_at);

alter table ai_chat_history enable row level security;

create policy "ai_chat_history anon read"   on ai_chat_history for select using (true);
create policy "ai_chat_history anon insert" on ai_chat_history for insert with check (true);

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

-- =============================================================
-- Pending Confirmations
-- docs/superpowers/specs/2026-09-15-pending-confirmations-design.md §6
--
-- No new tables. suggested_tier and final_tier stay separate on purpose: the
-- gap between them is the adoption rate and the miss rate.
-- Safe to re-run: every statement is guarded.
-- =============================================================
alter table family_messages add column if not exists sender_id text;
alter table family_messages add column if not exists recipient_id text;
alter table family_messages add column if not exists final_tier text
  check (final_tier in ('action', 'fyi', 'social'));
alter table family_messages add column if not exists tagged_by text
  check (tagged_by in ('sender_manual', 'sender_confirmed_ai'));
alter table family_messages add column if not exists suggested_tier text
  check (suggested_tier in ('action', 'fyi', 'social'));
alter table family_messages add column if not exists suggested_by text
  check (suggested_by in ('model'));
alter table family_messages add column if not exists acknowledged_at timestamptz;
alter table family_messages add column if not exists acknowledged_by text;
alter table family_messages add column if not exists followup_sent_at timestamptz;

-- Every row written to the live thread before sender_id existed came from the
-- caregiver app's "Send to family" button, so its direction is known.
update family_messages
  set sender_id = 'caregiver-001', recipient_id = 'janet-chen'
  where thread_id = 'caregiver-001__erin-yeung' and sender_id is null;

-- The Pending list is a view over this index, not a store (spec §1).
create index if not exists family_messages_pending_idx
  on family_messages (recipient_id, created_at)
  where final_tier = 'action' and acknowledged_at is null;

-- Confirm is the only update the browser may make: two columns, only on an
-- unconfirmed "Needs response" message, and never back to unconfirmed.
revoke update on family_messages from anon, authenticated;
grant update (acknowledged_at, acknowledged_by) on family_messages to anon, authenticated;

drop policy if exists "family_messages anon acknowledge" on family_messages;
create policy "family_messages anon acknowledge" on family_messages
  for update
  using (final_tier = 'action' and acknowledged_at is null)
  with check (acknowledged_at is not null);

-- =============================================================
-- Pending Confirmations, part 2: marking a message after it is sent
-- docs/superpowers/specs/2026-09-15-pending-confirmations-design.md §2.4
--
-- The first migration let the browser write only the confirmation columns, so
-- a message could not be marked after it was sent. The family screens now mark
-- by long-pressing a sent message, which needs one more transition.
--
-- Two permissive UPDATE policies cannot express this safely: Postgres OR's
-- their USING clauses and, separately, OR's their WITH CHECK clauses, so one
-- policy's row visibility can pair with another's approval — allowing a
-- message to be confirmed without ever being marked, or an existing tag to be
-- rewritten. A policy also cannot compare the old row with the new one.
--
-- So: one policy decides which rows are touchable, and a trigger validates the
-- transition itself. Exactly three transitions are allowed, and every other
-- column is immutable through this path.
-- Safe to re-run.
-- =============================================================
grant update (final_tier, tagged_by, acknowledged_at, acknowledged_by, suggested_tier, suggested_by) on family_messages to anon, authenticated;

drop policy if exists "family_messages anon acknowledge" on family_messages;
drop policy if exists "family_messages anon mark pending" on family_messages;
drop policy if exists "family_messages anon update" on family_messages;

create policy "family_messages anon update" on family_messages
  for update using (true) with check (true);

create or replace function family_messages_guard_update() returns trigger
language plpgsql as $$
begin
  -- Nothing but the four writable columns may move, whichever transition this is.
  if new.id is distinct from old.id
     or new.thread_id is distinct from old.thread_id
     or new.sender is distinct from old.sender
     or new.sender_id is distinct from old.sender_id
     or new.recipient_id is distinct from old.recipient_id
     or new.text is distinct from old.text
     or new.report_id is distinct from old.report_id
     or new.created_at is distinct from old.created_at
     or new.followup_sent_at is distinct from old.followup_sent_at then
    raise exception 'family_messages: that column cannot be changed';
  end if;

  -- 1. Marking an untagged message Pending. Once only: old.final_tier is null.
  if old.final_tier is null
     and new.final_tier = 'action'
     and new.tagged_by in ('sender_manual', 'sender_confirmed_ai')
     and new.acknowledged_at is not distinct from old.acknowledged_at
     and new.acknowledged_by is not distinct from old.acknowledged_by
     and new.suggested_tier is not distinct from old.suggested_tier
     and new.suggested_by is not distinct from old.suggested_by then
    return new;
  end if;

  -- 2. Confirming a message that is Pending and not yet confirmed. One way.
  if old.final_tier = 'action'
     and old.acknowledged_at is null
     and new.acknowledged_at is not null
     and new.acknowledged_by is not null
     and new.final_tier is not distinct from old.final_tier
     and new.tagged_by is not distinct from old.tagged_by
     and new.suggested_tier is not distinct from old.suggested_tier
     and new.suggested_by is not distinct from old.suggested_by then
    return new;
  end if;

  -- 3. Recording a model suggestion, which never touches the human tag
  --    (spec §4.3: write suggested_tier, never final_tier).
  if old.suggested_tier is null
     and new.suggested_tier in ('action', 'fyi', 'social')
     and new.suggested_by = 'model'
     and new.final_tier is not distinct from old.final_tier
     and new.tagged_by is not distinct from old.tagged_by
     and new.acknowledged_at is not distinct from old.acknowledged_at
     and new.acknowledged_by is not distinct from old.acknowledged_by then
    return new;
  end if;

  raise exception 'family_messages: only marking Pending, confirming, or recording a suggestion is allowed';
end;
$$;

drop trigger if exists family_messages_guard_update on family_messages;
create trigger family_messages_guard_update
  before update on family_messages
  for each row execute function family_messages_guard_update();
