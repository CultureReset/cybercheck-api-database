-- ============================================================
-- One-time invite tokens for group sharing
-- Paste into Supabase SQL Editor for project mhafixflyffflwjhcgfn
-- ============================================================

create table if not exists public.tourist_group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tourist_groups(id) on delete cascade,
  token text unique not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz not null default (now() + interval '48 hours'),
  created_at timestamptz default now()
);
create index if not exists idx_tgi_group on public.tourist_group_invites(group_id);
create index if not exists idx_tgi_token on public.tourist_group_invites(token);

-- RLS: creators can see their own; anyone with the token can read via service key (server only)
alter table public.tourist_group_invites enable row level security;

drop policy if exists "invites_select_own" on public.tourist_group_invites;
create policy "invites_select_own" on public.tourist_group_invites
  for select using (auth.uid() = invited_by);

drop policy if exists "invites_insert_own" on public.tourist_group_invites;
create policy "invites_insert_own" on public.tourist_group_invites
  for insert with check (auth.uid() = invited_by);
