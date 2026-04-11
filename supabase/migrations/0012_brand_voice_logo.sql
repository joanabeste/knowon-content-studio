-- Adds a logo path to the global brand voice row. The file itself
-- lives in the `generated-images` storage bucket (e.g. under
-- `brand/logo.png`) — this column only holds the path, not the
-- binary. On every blog image generate/upload the server loads
-- this file and composites it 1:1 into the bottom-right of the
-- brand-gradient overlay.

alter table public.brand_voice
  add column if not exists logo_path text;
