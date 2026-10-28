-- Winter decor: icy blue palette and a frame of snowflake, mitten, and
-- teacup tiles, modeled on the Snowshoe Mahjong save-the-date.

alter table public.events drop constraint events_decor_check;
alter table public.events
  add constraint events_decor_check
  check (decor in ('mountains', 'blooms', 'winter'));
