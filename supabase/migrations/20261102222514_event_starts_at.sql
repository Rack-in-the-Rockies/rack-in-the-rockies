-- Events get a real start time alongside ends_at. date_label stays the
-- free-text "how the date reads" field; the editor pre-fills it from this.
alter table public.events add column starts_at timestamptz;

-- Event images now upload from the browser with a one-time signed URL
-- (server actions cap request bodies at 1 MB), so the bucket enforces the
-- same limits the editor shows.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'event-images';
