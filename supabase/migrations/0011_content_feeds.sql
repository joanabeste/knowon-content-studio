-- =====================================================================
-- Content feeds — subscribed RSS/Atom URLs that get auto-synced into
-- the inspiration library. Users register a feed URL (typically from
-- rss.app or similar bridge services for LinkedIn/Instagram, or a
-- direct WordPress feed) and the sync action fetches + parses them.
-- =====================================================================

create table if not exists public.content_feeds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  channel channel not null,
  is_active boolean not null default true,
  last_synced_at timestamptz,
  last_error text,
  items_count int not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (url)
);

create index if not exists content_feeds_active_idx
  on public.content_feeds(is_active);

alter table public.content_feeds enable row level security;

drop policy if exists content_feeds_read on public.content_feeds;
create policy content_feeds_read on public.content_feeds
  for select to authenticated using (true);

drop policy if exists content_feeds_admin_write on public.content_feeds;
create policy content_feeds_admin_write on public.content_feeds
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
