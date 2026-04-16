-- Per-variant image attachments
--
-- Until now `images` carried only project-level blog hero pictures
-- (hence required storage_path + project_id). LinkedIn, Instagram,
-- Iprendo News, Newsletter and Eyefox variants all have the same
-- need for visuals, but images vary per channel (an Instagram square
-- is not a blog hero).
--
-- Two small schema changes let the existing table serve both worlds:
--
--   variant_id     — optional FK to the specific variant. When null,
--                    the row is a project-level image (old blog-hero
--                    semantics preserved for the WordPress publish
--                    flow). When set, the image belongs to that
--                    channel and only renders inside its card.
--
--   external_url   — for the "paste URL"-workflow: no upload, no
--                    bucket copy, just a reference to a public URL.
--                    storage_path becomes optional; a CHECK keeps at
--                    least one source present on every row.

alter table public.images
  add column if not exists variant_id uuid
    references public.content_variants(id) on delete cascade;

alter table public.images
  add column if not exists external_url text;

alter table public.images alter column storage_path drop not null;

alter table public.images
  drop constraint if exists images_has_source;

alter table public.images
  add constraint images_has_source
  check (storage_path is not null or external_url is not null);

create index if not exists images_variant_id_idx
  on public.images (variant_id)
  where variant_id is not null;
