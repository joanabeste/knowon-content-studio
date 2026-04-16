-- Add the "iprendo_news" enum value to the channel enums.
--
-- The `channel` and `source_post_source` columns are native Postgres
-- enum types (set up in the initial schema), not plain text. Extending
-- them requires ALTER TYPE rather than a CHECK constraint swap — which
-- the earlier draft of this migration got wrong (invalid cast error
-- when referencing the not-yet-added value inside the same statement).
--
-- Postgres forbids using a newly-added enum value inside the SAME
-- transaction that added it. Therefore: this migration ONLY adds the
-- values. The channel_brand_voice seed row lives in 0022.
--
-- IF NOT EXISTS makes re-running safe in case the value was added by
-- an earlier ad-hoc fix.

alter type public.channel add value if not exists 'iprendo_news';

-- source_post_source lists the same channels as valid origin types,
-- so the library's "Iprendo News" imports can be tagged properly.
do $$
begin
  if exists (
    select 1 from pg_type where typname = 'source_post_source'
  ) then
    execute 'alter type public.source_post_source add value if not exists ''iprendo_news''';
  end if;
end$$;
