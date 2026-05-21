-- ============================================================
-- Phase 1: Unified GCR + Trip Swipe Platform
-- GCR DB (GCR_SUPABASE_URL) — gcr_page_views lives here
-- Paste into Supabase SQL Editor for the GCR project
-- ============================================================

-- ── 1.2 gcr_page_views ──────────────────────────────────────
-- visitor_id: durable anonymous ID from localStorage (gcr_visitor_id)
--   already exists in some rows as visitor_id — confirm and ensure indexed
-- user_id: NULL until user signs up, then backfilled via
--   POST /api/tourist/backfill-anonymous

alter table public.gcr_page_views
  add column if not exists visitor_id text,
  add column if not exists user_id uuid;

comment on column public.gcr_page_views.visitor_id is
  'Durable anonymous visitor ID from localStorage — set before signup';
comment on column public.gcr_page_views.user_id is
  'Filled in via backfill when visitor creates an account';

create index if not exists idx_gcr_page_views_visitor
  on public.gcr_page_views(visitor_id);
create index if not exists idx_gcr_page_views_user
  on public.gcr_page_views(user_id);
create index if not exists idx_gcr_page_views_source
  on public.gcr_page_views(source);
