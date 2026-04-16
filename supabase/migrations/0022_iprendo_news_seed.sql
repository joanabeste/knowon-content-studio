-- Seed row for the new "iprendo_news" channel.
--
-- Split from 0021 because Postgres doesn't let you reference a
-- freshly-added enum value inside the same transaction where it was
-- introduced. Running this in a separate migration lets 0021 commit
-- first, so the cast in the INSERT below succeeds.
--
-- Effect: the brand-voice settings screen shows the "Iprendo News"
-- tab populated-but-empty. The general brand voice still applies
-- as the fallback for any empty per-channel field.

insert into public.channel_brand_voice (channel, updated_at)
values ('iprendo_news', now())
on conflict (channel) do nothing;
