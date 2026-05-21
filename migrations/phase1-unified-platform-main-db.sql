-- ============================================================
-- Phase 1: Unified GCR + Trip Swipe Platform
-- Main DB (SUPABASE_URL) — tourist tables, qr_scans, session_events
-- Paste into Supabase SQL Editor for the main project
-- ============================================================

-- ── 1.1 tourist_profiles ────────────────────────────────────
-- first_app: which product the user signed up from first
-- anonymous_visitor_id: the localStorage visitor ID they had before signing up
--   used to backfill all pre-signup activity to their new user_id

alter table public.tourist_profiles
  add column if not exists first_app text
    check (first_app in ('gcr', 'trip_swipe')),
  add column if not exists anonymous_visitor_id text;

comment on column public.tourist_profiles.first_app is
  'Which app the user first signed up from — gcr or trip_swipe';
comment on column public.tourist_profiles.anonymous_visitor_id is
  'The gcr_visitor_id from localStorage at signup time, used to backfill pre-signup activity';

create index if not exists idx_tourist_profiles_first_app
  on public.tourist_profiles(first_app);
create index if not exists idx_tourist_profiles_anon_visitor
  on public.tourist_profiles(anonymous_visitor_id);


-- ── 1.3 session_events ──────────────────────────────────────
-- visitor_id: durable anonymous ID from localStorage (gcr_visitor_id)
-- user_id: filled in after backfill when user signs up

alter table public.session_events
  add column if not exists visitor_id text,
  add column if not exists user_id uuid references auth.users(id);

create index if not exists idx_session_events_visitor
  on public.session_events(visitor_id);
create index if not exists idx_session_events_user
  on public.session_events(user_id);


-- ── 1.4 qr_scans ────────────────────────────────────────────
-- visitor_id: lets us link a QR scan to a user after they sign up
-- user_id: filled in after backfill

alter table public.qr_scans
  add column if not exists visitor_id text,
  add column if not exists user_id uuid references auth.users(id);

create index if not exists idx_qr_scans_visitor
  on public.qr_scans(visitor_id);
create index if not exists idx_qr_scans_user
  on public.qr_scans(user_id);


-- ── 1.5a tourist_saves ──────────────────────────────────────
-- source_app: was this save made from GCR or Trip Swipe?

alter table public.tourist_saves
  add column if not exists source_app text default 'trip_swipe'
    check (source_app in ('gcr', 'trip_swipe'));

comment on column public.tourist_saves.source_app is
  'Which app surface the save was made from';


-- ── 1.5b tourist_swipe_events ───────────────────────────────
-- source_app: was this swipe made from GCR or Trip Swipe?

alter table public.tourist_swipe_events
  add column if not exists source_app text default 'trip_swipe'
    check (source_app in ('gcr', 'trip_swipe'));

comment on column public.tourist_swipe_events.source_app is
  'Which app surface the swipe was made from';
