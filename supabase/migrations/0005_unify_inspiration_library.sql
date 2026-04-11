-- =====================================================================
-- Unify golden_examples + source_posts into a single inspiration library.
--
-- Goals:
--  1. source_posts becomes THE canonical inspiration library
--  2. Add channel + is_featured so any post can be both "inspiration"
--     and "hand-picked exemplar" without needing a second table
--  3. Extend the allowed `source` values for all sync targets
--  4. Migrate all golden_examples rows into source_posts (marked as
--     featured) and drop the old table
-- =====================================================================

-- ---------- 1. Add new columns to source_posts ----------
alter table public.source_posts
  add column if not exists channel channel,
  add column if not exists is_featured boolean not null default false;

-- Backfill channel for existing WordPress-sourced rows → all blog
update public.source_posts
  set channel = 'blog'
  where channel is null and source = 'wordpress';

-- Any remaining rows without channel: default to blog (safe fallback)
update public.source_posts
  set channel = 'blog'
  where channel is null;

-- Now enforce NOT NULL
alter table public.source_posts
  alter column channel set not null;

-- Replace the old source check constraint with an expanded one
alter table public.source_posts
  drop constraint if exists source_posts_source_check;

alter table public.source_posts
  add constraint source_posts_source_check check (
    source in ('wordpress','linkedin','instagram','eyefox','newsletter','url_import','manual','csv')
  );

-- Helpful composite index for the "sample by channel" query
create index if not exists source_posts_channel_featured_idx
  on public.source_posts(channel, is_featured desc, published_at desc nulls last);

-- ---------- 2. Migrate golden_examples → source_posts ----------
-- Each golden example becomes a featured source_post with source='manual'.
-- Deduplication by title (within same channel) avoids duplicating
-- entries that may already exist if this migration is re-run.
insert into public.source_posts
  (source, external_id, url, title, body, published_at, imported_at, tags, channel, is_featured)
select
  'manual'::text,
  'golden_' || ge.id::text,          -- synthetic external_id to prevent dup on re-run
  null,
  coalesce(ge.title, left(ge.body, 60)),
  ge.body,
  ge.created_at,
  now(),
  '{}',
  ge.channel,
  true
from public.golden_examples ge
on conflict (source, external_id) do nothing;

-- ---------- 3. Drop the golden_examples table ----------
-- Drop dependent policies first (idempotent safety)
drop policy if exists golden_read on public.golden_examples;
drop policy if exists golden_admin_write on public.golden_examples;

drop table if exists public.golden_examples;

-- ---------- Done ----------
-- Notes for the app layer:
--  * source_posts IS the inspiration library; query it with channel filters
--  * is_featured replaces the old golden_examples concept
--  * Sync handlers should upsert with (source, external_id) conflict target
