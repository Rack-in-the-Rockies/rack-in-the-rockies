-- AI-designed event themes: the design recipe Claude returns (palette,
-- accent font, tile layout, vector icons) and the description it came from.
-- The app sanitizes the recipe before saving. When set, it overrides decor.
--
-- Already applied to the hosted project through the Supabase connector, which
-- recorded it under its own timestamp. "if not exists" keeps a later
-- `supabase db push` of this file harmless.

alter table public.events
  add column if not exists theme jsonb,
  add column if not exists theme_prompt text;
