-- Phase 2 announcement sending. Spec:
-- docs/superpowers/specs/2026-07-30-announcement-sending-phase-2-design.md

create table public.sends (
  id uuid primary key default gen_random_uuid(),
  template text not null check (template in ('event-announcement', 'general-update')),
  subject text not null,
  fields jsonb not null,
  audience jsonb not null,
  status text not null default 'sending'
    check (status in ('sending', 'sent', 'partial', 'failed')),
  total_count integer not null,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Recipient snapshot. chunk_index is assigned once at snapshot time so a
-- resumed chunk reuses its idempotency key against an identical payload.
create table public.send_recipients (
  id uuid primary key default gen_random_uuid(),
  send_id uuid not null references public.sends (id) on delete cascade,
  subscriber_id uuid not null references public.subscribers (id) on delete cascade,
  email text not null,
  chunk_index integer not null,
  resend_email_id text,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'delivered', 'bounced', 'complained')),
  error text,
  updated_at timestamptz not null default now(),
  unique (send_id, subscriber_id)
);

create index send_recipients_send_id_idx on public.send_recipients (send_id);
create index send_recipients_resend_email_id_idx on public.send_recipients (resend_email_id);

-- Tag filtering (admin list + audience selection) needs array containment.
create index subscribers_tags_idx on public.subscribers using gin (tags);

create trigger send_recipients_set_updated_at
  before update on public.send_recipients
  for each row execute function public.set_updated_at();

-- Fail closed, like subscribers: server-side secret-key access only.
alter table public.sends enable row level security;
alter table public.send_recipients enable row level security;
revoke all on public.sends from anon, authenticated;
revoke all on public.send_recipients from anon, authenticated;
