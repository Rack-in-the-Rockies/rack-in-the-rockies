-- Phase 3 Part A: event builder. Spec:
-- docs/superpowers/specs/2026-07-31-event-builder-and-registration-phase-3-design.md

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  partner text,
  date_label text not null default '',
  ends_at timestamptz,
  location text not null default '',
  blurb text not null default '',
  banner_text text not null default '',
  external_signup_url text,
  payment_instructions text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sessions are a table (not jsonb) because Part B registrations will
-- reference them and count seats against capacity.
create table public.event_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  time_label text not null,
  price_label text not null,
  capacity integer check (capacity is null or capacity > 0),
  sort_order integer not null default 0
);

create index event_sessions_event_id_idx on public.event_sessions (event_id);
create index events_status_ends_at_idx on public.events (status, ends_at);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- Fail closed, like every other table: server-side secret-key access only.
alter table public.events enable row level security;
alter table public.event_sessions enable row level security;
revoke all on public.events from anon, authenticated;
revoke all on public.event_sessions from anon, authenticated;
