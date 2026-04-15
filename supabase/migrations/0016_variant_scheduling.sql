-- Posting calendar scheduling fields
--
-- Until now content_variants only tracked when a row was created
-- (created_at) and when it was reviewed (reviewed_at). For the
-- editorial calendar we need two additional timestamps:
--
--   scheduled_at  — when the team plans to publish this variant.
--                   Set manually from the project detail page or
--                   via drag & drop on the calendar. Nullable,
--                   since not every variant is scheduled yet.
--
--   published_at  — when the variant actually went live. Set
--                   automatically by the app when a variant's
--                   status transitions to `published`, mirroring
--                   the existing reviewed_at pattern for approvals.
--
-- Both columns get a partial index (where ... is not null) so the
-- calendar can do fast range scans without bloating the index with
-- the many null rows that will exist early on.

alter table public.content_variants
  add column if not exists scheduled_at timestamptz null;

alter table public.content_variants
  add column if not exists published_at timestamptz null;

create index if not exists content_variants_scheduled_at_idx
  on public.content_variants (scheduled_at)
  where scheduled_at is not null;

create index if not exists content_variants_published_at_idx
  on public.content_variants (published_at)
  where published_at is not null;
