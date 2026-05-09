-- ============================================================
-- TripSwipe tracking additions
-- Paste into Supabase SQL Editor for project mhafixflyffflwjhcgfn
-- ============================================================

-- 1. Super Like flag on saves
alter table public.tourist_saves
  add column if not exists is_super_like boolean default false;

-- 2. Swipe direction events (like / nope / super per business per user)
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

-- RLS: tourists can only insert/read their own events
alter table public.tourist_swipe_events enable row level security;

drop policy if exists "own_swipes_insert" on public.tourist_swipe_events;
create policy "own_swipes_insert" on public.tourist_swipe_events
  for insert with check (auth.uid() = user_id);

drop policy if exists "own_swipes_select" on public.tourist_swipe_events;
create policy "own_swipes_select" on public.tourist_swipe_events
  for select using (auth.uid() = user_id);
