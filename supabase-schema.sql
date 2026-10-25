-- ============================================================================
-- Study Buddy — Supabase schema (messages + puškice + friend codes)
--
-- HOW TO RUN:
--   1. Open https://supabase.com/dashboard/project/tsmwgrgazshsllioelku/sql/new
--   2. Paste this whole file and press "Run" (or use the SQL Editor).
--   3. Done — the app creates rows automatically from then on.
--
-- Safe to re-run: everything uses "if not exists".
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) profiles — one row per logged-in student, holds the 6-char friend code
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text,
  code         text unique
);

-- ---------------------------------------------------------------------------
-- 2) messages — direct messages between students
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid not null references public.profiles (id) on delete cascade,
  to_id      uuid not null references public.profiles (id) on delete cascade,
  text       text not null,
  kind       text not null default 'text',   -- 'text' | 'share'
  title      text,
  created_at timestamptz not null default now()
);

create index if not exists messages_pair_idx
  on public.messages (from_id, to_id, created_at);
create index if not exists messages_inbox_idx
  on public.messages (to_id, created_at);

-- ---------------------------------------------------------------------------
-- 3) puskice — cheat sheets saved by the student
-- ---------------------------------------------------------------------------
create table if not exists public.puskice (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  subject    text not null default '',
  markdown   text not null default '',
  kind       text not null default 'images', -- 'images' | 'pdf'
  file_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists puskice_user_idx
  on public.puskice (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4) Row Level Security — students only ever see their own data
--    (profiles are readable so friend codes can be looked up)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.messages enable row level security;
alter table public.puskice   enable row level security;

-- profiles: any signed-in student can search by code, but only edit their own
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (true);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- messages: you can read/write only conversations you are part of
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (from_id = auth.uid());

drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages
  for update to authenticated
  using (from_id = auth.uid())
  with check (from_id = auth.uid());

drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages
  for delete to authenticated
  using (from_id = auth.uid());

-- puskice: strictly private to their owner
drop policy if exists puskice_all on public.puskice;
create policy puskice_all on public.puskice
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
