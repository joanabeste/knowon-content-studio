-- Add the "iprendo_news" channel.
--
-- The Channel enum is a plain text column in the app tables
-- (content_variants.channel, source_posts.channel, channel_brand_voice.channel,
-- content_feeds.channel). If the initial schema put a CHECK constraint on
-- any of those, it would reject the new value on insert. We defensively
-- look each one up and drop/recreate its check to include the new value.
-- If no such check exists the DO-block simply no-ops.
--
-- A seed row in channel_brand_voice ensures the brand-voice settings
-- page shows the new channel immediately. Empty fields are fine — the
-- general brand voice still applies as the fallback.

do $$
declare
  r record;
begin
  for r in
    select conrelid::regclass::text as tbl, conname
    from pg_constraint
    where contype = 'c'
      and pg_get_constraintdef(oid) ilike '%channel%'
      and pg_get_constraintdef(oid) ilike '%linkedin%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end$$;

-- Re-create the check (locked, idempotent) on the tables that are
-- known to carry a channel column. IF EXISTS keeps it safe in dev
-- environments that may not have provisioned every table yet.
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'content_variants' and table_schema = 'public') then
    alter table public.content_variants
      add constraint content_variants_channel_check
      check (channel in ('linkedin','instagram','iprendo_news','eyefox','newsletter','blog'));
  end if;
  if exists (select 1 from information_schema.tables where table_name = 'source_posts' and table_schema = 'public') then
    alter table public.source_posts
      add constraint source_posts_channel_check
      check (channel in ('linkedin','instagram','iprendo_news','eyefox','newsletter','blog'));
  end if;
  if exists (select 1 from information_schema.tables where table_name = 'channel_brand_voice' and table_schema = 'public') then
    alter table public.channel_brand_voice
      add constraint channel_brand_voice_channel_check
      check (channel in ('linkedin','instagram','iprendo_news','eyefox','newsletter','blog'));
  end if;
  if exists (select 1 from information_schema.tables where table_name = 'content_feeds' and table_schema = 'public') then
    alter table public.content_feeds
      add constraint content_feeds_channel_check
      check (channel in ('linkedin','instagram','iprendo_news','eyefox','newsletter','blog'));
  end if;
exception
  when duplicate_object then null;
end$$;

-- Seed the channel_brand_voice row so the "Iprendo News" tab shows up
-- populated-but-empty in the brand voice settings page.
insert into public.channel_brand_voice (channel, updated_at)
values ('iprendo_news', now())
on conflict (channel) do nothing;
