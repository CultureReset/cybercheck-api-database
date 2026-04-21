-- ============================================================
-- Trip Swipe tourist tables
-- Paste into Supabase SQL Editor for project mhafixflyffflwjhcgfn
-- ============================================================

-- Tourist profile (extends auth.users)
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

-- Saved places (swipe-right)
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

-- Itineraries (AI-built trip plans)
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

-- updated_at trigger (namespaced to avoid colliding with any existing touch_updated_at)
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

-- ============================================================
-- Row Level Security: users see/edit only their own rows.
-- Admin (service_role) bypasses RLS automatically.
-- ============================================================
alter table public.tourist_profiles    enable row level security;
alter table public.tourist_saves       enable row level security;
alter table public.tourist_itineraries enable row level security;

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
create policy "own_saves_select" on public.tourist_saves
  for select using (auth.uid() = user_id);
drop policy if exists "own_saves_insert" on public.tourist_saves;
create policy "own_saves_insert" on public.tourist_saves
  for insert with check (auth.uid() = user_id);
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
