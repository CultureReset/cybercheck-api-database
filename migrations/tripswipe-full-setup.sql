-- ============================================================
-- Trip Swipe — full setup (run once in Supabase SQL Editor)
-- Project: mhafixflyffflwjhcgfn
-- Combines: tourist-tables + setup-questions + groups + tracking
-- ============================================================

-- ── 1. Base tables ───────────────────────────────────────────

create table if not exists public.tourist_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  destination text,
  arrival date,
  departure date,
  trip_days int,
  group_type text,
  budget text,
  interests jsonb default '[]'::jsonb,
  stay_status text,
  hotel_name text,
  setup_complete boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.tourist_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_id uuid,
  entity_slug text,
  business_name text,
  hero_image_url text,
  subtitle text,
  category text,
  rating numeric,
  price_range text,
  saved_at timestamptz default now(),
  unique(user_id, entity_slug)
);
create index if not exists idx_tourist_saves_user on public.tourist_saves(user_id);

create table if not exists public.tourist_itineraries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  destination text,
  days jsonb not null default '[]'::jsonb,
  model_used text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_tourist_itineraries_user on public.tourist_itineraries(user_id);

create or replace function public.tourist_touch_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_tourist_profiles_updated on public.tourist_profiles;
create trigger trg_tourist_profiles_updated before update on public.tourist_profiles
  for each row execute function public.tourist_touch_updated_at();

drop trigger if exists trg_tourist_itineraries_updated on public.tourist_itineraries;
create trigger trg_tourist_itineraries_updated before update on public.tourist_itineraries
  for each row execute function public.tourist_touch_updated_at();

-- ── 2. Setup questions + profile.answers ─────────────────────

create table if not exists public.tourist_setup_questions (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  subtitle text,
  input_type text not null,
  options jsonb default '[]'::jsonb,
  placeholder text,
  required boolean default false,
  sort_order int default 100,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_tsq_active_order on public.tourist_setup_questions(active, sort_order);

drop trigger if exists trg_tsq_updated on public.tourist_setup_questions;
create trigger trg_tsq_updated before update on public.tourist_setup_questions
  for each row execute function public.tourist_touch_updated_at();

alter table public.tourist_profiles add column if not exists answers jsonb default '{}'::jsonb;

-- ── 3. Groups ─────────────────────────────────────────────────

create table if not exists public.tourist_groups (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  invite_code text unique,
  name text not null,
  destination text,
  arrival date,
  departure date,
  sharing_mode text default 'trip_end' check (sharing_mode in ('trip_end','custom_date','ongoing')),
  sharing_until date,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_tourist_groups_owner on public.tourist_groups(owner_user_id);

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

alter table public.tourist_saves add column if not exists group_id uuid
  references public.tourist_groups(id) on delete set null;
create index if not exists idx_tourist_saves_group on public.tourist_saves(group_id);

drop trigger if exists trg_tourist_groups_updated on public.tourist_groups;
create trigger trg_tourist_groups_updated before update on public.tourist_groups
  for each row execute function public.tourist_touch_updated_at();

-- ── 4. Tracking (super likes + swipe events) ─────────────────

alter table public.tourist_saves
  add column if not exists is_super_like boolean default false;

create table if not exists public.tourist_swipe_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  entity_slug text not null,
  business_name text,
  category    text,
  direction   text not null check (direction in ('like','nope','super')),
  swiped_at   timestamptz default now()
);
create index if not exists idx_tse_user  on public.tourist_swipe_events(user_id);
create index if not exists idx_tse_slug  on public.tourist_swipe_events(entity_slug);
create index if not exists idx_tse_dir   on public.tourist_swipe_events(direction);
create index if not exists idx_tse_time  on public.tourist_swipe_events(swiped_at);

-- ── 5. Row Level Security ─────────────────────────────────────

alter table public.tourist_profiles    enable row level security;
alter table public.tourist_saves       enable row level security;
alter table public.tourist_itineraries enable row level security;
alter table public.tourist_setup_questions enable row level security;
alter table public.tourist_groups        enable row level security;
alter table public.tourist_group_members enable row level security;
alter table public.tourist_swipe_events  enable row level security;

-- tourist_profiles
drop policy if exists "own_profile_select" on public.tourist_profiles;
create policy "own_profile_select" on public.tourist_profiles
  for select using (auth.uid() = user_id);
drop policy if exists "own_profile_insert" on public.tourist_profiles;
create policy "own_profile_insert" on public.tourist_profiles
  for insert with check (auth.uid() = user_id);
drop policy if exists "own_profile_update" on public.tourist_profiles;
create policy "own_profile_update" on public.tourist_profiles
  for update using (auth.uid() = user_id);

-- tourist_saves
drop policy if exists "own_saves_select" on public.tourist_saves;
drop policy if exists "saves_select_group_members" on public.tourist_saves;
create policy "own_saves_select" on public.tourist_saves
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
drop policy if exists "own_saves_insert" on public.tourist_saves;
create policy "own_saves_insert" on public.tourist_saves
  for insert with check (auth.uid() = user_id);
drop policy if exists "own_saves_update" on public.tourist_saves;
create policy "own_saves_update" on public.tourist_saves
  for update using (auth.uid() = user_id);
drop policy if exists "own_saves_delete" on public.tourist_saves;
create policy "own_saves_delete" on public.tourist_saves
  for delete using (auth.uid() = user_id);

-- tourist_itineraries
drop policy if exists "own_itin_select" on public.tourist_itineraries;
create policy "own_itin_select" on public.tourist_itineraries
  for select using (auth.uid() = user_id);
drop policy if exists "own_itin_insert" on public.tourist_itineraries;
create policy "own_itin_insert" on public.tourist_itineraries
  for insert with check (auth.uid() = user_id);
drop policy if exists "own_itin_update" on public.tourist_itineraries;
create policy "own_itin_update" on public.tourist_itineraries
  for update using (auth.uid() = user_id);
drop policy if exists "own_itin_delete" on public.tourist_itineraries;
create policy "own_itin_delete" on public.tourist_itineraries
  for delete using (auth.uid() = user_id);

-- tourist_setup_questions (public read, service key writes)
drop policy if exists "tsq_select_active" on public.tourist_setup_questions;
create policy "tsq_select_active" on public.tourist_setup_questions
  for select using (active = true);

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

-- tourist_swipe_events
drop policy if exists "own_swipes_insert" on public.tourist_swipe_events;
create policy "own_swipes_insert" on public.tourist_swipe_events
  for insert with check (auth.uid() = user_id);
drop policy if exists "own_swipes_select" on public.tourist_swipe_events;
create policy "own_swipes_select" on public.tourist_swipe_events
  for select using (auth.uid() = user_id);
