-- Phase 3 Part B: registration + hero art. Spec:
-- docs/superpowers/specs/2026-07-31-event-builder-and-registration-phase-3-design.md

alter table public.events
  add column image_url text,
  add column image_alt text;

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  session_id uuid not null references public.event_sessions (id) on delete cascade,
  first_name text not null,
  last_name text,
  email text not null,
  seats integer not null default 1 check (seats between 1 and 4),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  cancel_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index event_registrations_session_id_idx on public.event_registrations (session_id);
create index event_registrations_event_id_idx on public.event_registrations (event_id);
create index event_registrations_email_idx on public.event_registrations (email);

create trigger event_registrations_set_updated_at
  before update on public.event_registrations
  for each row execute function public.set_updated_at();

alter table public.event_registrations enable row level security;
revoke all on public.event_registrations from anon, authenticated;

-- Registrants are side-effect subscribed with their own provenance value.
alter table public.subscribers drop constraint subscribers_source_check;
alter table public.subscribers add constraint subscribers_source_check
  check (source in ('newsletter', 'contact', 'booking', 'trips-waitlist', 'import', 'resend-migration', 'event-registration'));

-- Public-read bucket for event hero images. Writes happen server-side with
-- the secret key (bypasses storage RLS), so no write policies are needed.
insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;
