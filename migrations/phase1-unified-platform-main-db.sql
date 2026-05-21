-- ============================================================
-- Phase 1: Unified GCR + Trip Swipe Platform
-- Paste into Supabase SQL Editor
-- ============================================================

-- ── 1.1 tourist_profiles ────────────────────────────────────
alter table public.tourist_profiles
  add column if not exists first_app text
    check (first_app in ('gcr', 'trip_swipe')),
  add column if not exists anonymous_visitor_id text;

create index if not exists idx_tourist_profiles_first_app
  on public.tourist_profiles(first_app);
create index if not exists idx_tourist_profiles_anon_visitor
  on public.tourist_profiles(anonymous_visitor_id);

-- ── 1.2 gcr_page_views ──────────────────────────────────────
alter table public.gcr_page_views
  add column if not exists visitor_id text,
  add column if not exists user_id uuid references auth.users(id);

create index if not exists idx_gcr_page_views_visitor
  on public.gcr_page_views(visitor_id);
create index if not exists idx_gcr_page_views_user
  on public.gcr_page_views(user_id);

-- ── 1.3 session_events ──────────────────────────────────────
alter table public.session_events
  add column if not exists visitor_id text,
  add column if not exists user_id uuid references auth.users(id);

create index if not exists idx_session_events_visitor
  on public.session_events(visitor_id);
create index if not exists idx_session_events_user
  on public.session_events(user_id);

-- ── 1.4 qr_scans ────────────────────────────────────────────
alter table public.qr_scans
  add column if not exists visitor_id text,
  add column if not exists user_id uuid references auth.users(id);

create index if not exists idx_qr_scans_visitor
  on public.qr_scans(visitor_id);
create index if not exists idx_qr_scans_user
  on public.qr_scans(user_id);

-- ── 1.5 tourist_saves ───────────────────────────────────────
alter table public.tourist_saves
  add column if not exists source_app text default 'trip_swipe'
    check (source_app in ('gcr', 'trip_swipe'));

-- ── 1.5 tourist_swipe_events ────────────────────────────────
alter table public.tourist_swipe_events
  add column if not exists source_app text default 'trip_swipe'
    check (source_app in ('gcr', 'trip_swipe'));
