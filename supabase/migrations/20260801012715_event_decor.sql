-- Per-event decor choice (Tyler's live review of Phase 3B): the flower art
-- returns as an option alongside the default mountains. An uploaded image
-- still overrides either.

alter table public.events
  add column decor text not null default 'mountains'
  check (decor in ('mountains', 'blooms'));

-- Mahjong in Bloom keeps its flowers.
update public.events set decor = 'blooms' where title = 'Mahjong in Bloom';
