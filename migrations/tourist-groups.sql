-- ============================================================
-- Trip Swipe group planning — paste into Supabase SQL Editor
-- Project: mhafixflyffflwjhcgfn
-- ============================================================

-- A "group" = a shared trip planning session (e.g. "Beach trip June 2026")
create table if not exists public.tourist_groups (
  id uuid primary key default gen_random_uuid(),
  slug text unique,                -- URL slug like 'beach-june-2026-abc123'
  invite_code text unique,         -- 6-char short code for verbal sharing
  name text not null,
  destination text,
  arrival date,
  departure date,
  -- Sharing duration: 'trip_end' (day after departure), 'custom_date' (see sharing_until), 'ongoing' (never expires)
  sharing_mode text default 'trip_end' check (sharing_mode in ('trip_end','custom_date','ongoing')),
  sharing_until date,  -- only used when sharing_mode='custom_date'
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- Safe for re-runs if table already existed without these columns:
alter table public.tourist_groups add column if not exists sharing_mode text default 'trip_end';
alter table public.tourist_groups add column if not exists sharing_until date;
-- Drop old constraint if present, then re-add safely
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'tourist_groups_sharing_mode_check') then
    alter table public.tourist_groups drop constraint tourist_groups_sharing_mode_check;
  end if;
  alter table public.tourist_groups add constraint tourist_groups_sharing_mode_check
    check (sharing_mode in ('trip_end','custom_date','ongoing'));
end $$;
create index if not exists idx_tourist_groups_owner on public.tourist_groups(owner_user_id);

-- Membership (a user can be in many groups)
create table if not exists public.tourist_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tourist_groups(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  display_name text,
  joined_at timestamptz default now(),
  unique(group_id, user_id)
);
create index if not exists idx_tgm_group on public.tourist_group_members(group_id);
create index if not exists idx_tgm_user  on public.tourist_group_members(user_id);

-- Tag existing saves with an optional group (swipe-right that belongs to a group trip)
alter table public.tourist_saves add column if not exists group_id uuid
  references public.tourist_groups(id) on delete set null;
create index if not exists idx_tourist_saves_group on public.tourist_saves(group_id);

-- updated_at trigger (reuse existing helper from tourist-tables.sql)
drop trigger if exists trg_tourist_groups_updated on public.tourist_groups;
create trigger trg_tourist_groups_updated before update on public.tourist_groups
  for each row execute function public.tourist_touch_updated_at();

-- ============================================================
-- Row Level Security
-- Users only read groups they're members of, only write own memberships.
-- ============================================================
alter table public.tourist_groups        enable row level security;
alter table public.tourist_group_members enable row level security;

-- tourist_groups
drop policy if exists "group_select_members" on public.tourist_groups;
create policy "group_select_members" on public.tourist_groups
  for select using (
    auth.uid() = owner_user_id
    OR exists (
      select 1 from public.tourist_group_members m
      where m.group_id = tourist_groups.id and m.user_id = auth.uid()
    )
  );
drop policy if exists "group_insert_own" on public.tourist_groups;
create policy "group_insert_own" on public.tourist_groups
  for insert with check (auth.uid() = owner_user_id);
drop policy if exists "group_update_owner" on public.tourist_groups;
create policy "group_update_owner" on public.tourist_groups
  for update using (auth.uid() = owner_user_id);
drop policy if exists "group_delete_owner" on public.tourist_groups;
create policy "group_delete_owner" on public.tourist_groups
  for delete using (auth.uid() = owner_user_id);

-- tourist_group_members
drop policy if exists "gm_select_member" on public.tourist_group_members;
create policy "gm_select_member" on public.tourist_group_members
  for select using (
    auth.uid() = user_id
    OR exists (
      select 1 from public.tourist_group_members m2
      where m2.group_id = tourist_group_members.group_id and m2.user_id = auth.uid()
    )
  );
drop policy if exists "gm_insert_self" on public.tourist_group_members;
create policy "gm_insert_self" on public.tourist_group_members
  for insert with check (auth.uid() = user_id);
drop policy if exists "gm_delete_self" on public.tourist_group_members;
create policy "gm_delete_self" on public.tourist_group_members
  for delete using (auth.uid() = user_id);

-- ============================================================
-- Extend tourist_saves policy so group members can SEE each other's saves
-- (only for saves tagged to a group they both belong to)
-- ============================================================
drop policy if exists "saves_select_group_members" on public.tourist_saves;
create policy "saves_select_group_members" on public.tourist_saves
  for select using (
    auth.uid() = user_id
    OR (
      group_id is not null
      AND exists (
        select 1 from public.tourist_group_members m
        where m.group_id = tourist_saves.group_id and m.user_id = auth.uid()
      )
    )
  );
