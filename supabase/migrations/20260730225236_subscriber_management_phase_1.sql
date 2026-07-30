-- Phase 1 subscriber management. Spec:
-- docs/superpowers/specs/2026-07-30-subscriber-management-phase-1-design.md

create schema if not exists private;

-- profiles: one row per authenticated user. Role lives HERE, never in
-- user_metadata (user_metadata is self-editable).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  first_name text,
  last_name text,
  status text not null default 'subscribed'
    check (status in ('subscribed', 'unsubscribed', 'bounced', 'complained')),
  source text not null
    check (source in ('newsletter', 'contact', 'booking', 'trips-waitlist', 'import', 'resend-migration')),
  tags text[] not null default '{}',
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscribers_status_idx on public.subscribers (status);
create index subscribers_source_idx on public.subscribers (source);

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger subscribers_set_updated_at
  before update on public.subscribers
  for each row execute function public.set_updated_at();

-- Auto-create a profile per auth user. SECURITY DEFINER, therefore in the
-- private schema (spec requirement: not reachable via the Data API).
-- Role is NOT taken from metadata; the column default 'member' applies.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- RLS
alter table public.subscribers enable row level security;
alter table public.profiles enable row level security;

-- subscribers: fail closed. No policies, no grants. Server code uses the
-- secret key which bypasses RLS.
revoke all on public.subscribers from anon, authenticated;

-- profiles: user may read own row and update own display_name only.
-- Column-level grant is what makes role immutable to its owner; RLS cannot
-- compare old and new values.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy "read own profile" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
