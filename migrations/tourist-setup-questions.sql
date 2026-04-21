-- ============================================================
-- Editable signup/setup questions for trip-swipe
-- Paste into Supabase SQL Editor for project mhafixflyffflwjhcgfn
-- ============================================================

create table if not exists public.tourist_setup_questions (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,              -- 'destination', 'stay_status', 'group_size', etc.
  label text not null,                   -- displayed question text
  subtitle text,                         -- optional helper text
  input_type text not null,              -- 'text' | 'email' | 'number' | 'date' | 'textarea' | 'select' | 'multi_select' | 'radio' | 'tags' | 'daterange'
  options jsonb default '[]'::jsonb,     -- for select/radio/multi_select/tags: [{value, label, icon?}]
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

-- Store custom answers alongside the fixed profile fields
alter table public.tourist_profiles add column if not exists answers jsonb default '{}'::jsonb;

-- RLS: everyone can read ACTIVE questions (public), only service key writes
alter table public.tourist_setup_questions enable row level security;
drop policy if exists "tsq_select_active" on public.tourist_setup_questions;
create policy "tsq_select_active" on public.tourist_setup_questions
  for select using (active = true);

-- ============================================================
-- Seed default questions (matches what Setup.jsx asked hardcoded)
-- Safe: only inserts when the key doesn't already exist
-- ============================================================
insert into public.tourist_setup_questions (key, label, subtitle, input_type, options, placeholder, required, sort_order)
values
  ('name',         'What''s your name?',                       null, 'text',       '[]'::jsonb, 'First name',         true,  10),
  ('destination',  'Where are you going?',                     'City or area',     'text',       '[]'::jsonb, 'Destin, FL',         true,  20),
  ('daterange',    'When is your trip?',                       null, 'daterange',  '[]'::jsonb, null,                 false, 30),
  ('group_type',   'Who''s with you?',                         null, 'radio',      '[{"value":"solo","label":"Solo"},{"value":"couple","label":"Couple"},{"value":"family","label":"Family"},{"value":"friends","label":"Friends"}]'::jsonb, null, true, 40),
  ('group_size',   'How many people?',                         null, 'number',     '[]'::jsonb, '2',                  false, 50),
  ('budget',       'What''s your budget vibe?',                null, 'radio',      '[{"value":"$","label":"Chill — $"},{"value":"$$","label":"Balanced — $$"},{"value":"$$$","label":"Splurge — $$$"}]'::jsonb, null, false, 60),
  ('stay_status',  'Do you have a place to stay yet?',         null, 'radio',      '[{"value":"booked","label":"Already booked"},{"value":"looking","label":"Still looking"},{"value":"other","label":"Staying with friends"}]'::jsonb, null, false, 70),
  ('hotel_name',   'Where are you staying?',                   'Optional — helps us suggest nearby spots', 'text', '[]'::jsonb, 'Hotel / condo name', false, 80),
  ('interests',    'What are you into?',                       'Pick a few',       'tags',       '[{"value":"beach","label":"🏖️ Beach"},{"value":"food","label":"🍽️ Food"},{"value":"drinks","label":"🍹 Drinks"},{"value":"live_music","label":"🎵 Live music"},{"value":"activities","label":"🏄 Activities"},{"value":"shopping","label":"🛍️ Shopping"},{"value":"family","label":"👨‍👩‍👧 Family-friendly"},{"value":"nightlife","label":"🌃 Nightlife"}]'::jsonb, null, false, 90)
on conflict (key) do nothing;
