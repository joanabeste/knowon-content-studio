-- Two additions that together make generations "learn" from approved work:
--
-- 1. brand_voice.tone_examples — a freetext block the admin can fill in
--    with a handful of perfect example sentences ("so klingen wir
--    wirklich"). Unlike the few-shot inspiration posts which rotate
--    depending on relevance, this is a hardcoded anchor that ships
--    with every single generation prompt.
--
-- 2. A new source enum value `approved_variant`. Whenever a variant
--    gets flipped to "approved", the app auto-writes it back into
--    source_posts with is_featured=true. That way the next generation
--    picks from freshly-reviewed KnowOn texts, not just imported
--    historic content — the system slowly teaches itself.

-- ---------------------------------------------------------------
-- 1. Tone examples freetext on brand_voice
-- ---------------------------------------------------------------

alter table public.brand_voice
  add column if not exists tone_examples text;

-- ---------------------------------------------------------------
-- 2. New source enum value for auto-promoted approved variants
-- ---------------------------------------------------------------
-- Postgres enums can only have values added (never removed without
-- full enum recreation). `add value if not exists` is idempotent on
-- re-run. Using `do $$` because alter type add value can't sit in a
-- regular transaction with other statements in some PG versions.

do $$
begin
  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'public.source_post_source'::regtype
      and enumlabel = 'approved_variant'
  ) then
    alter type public.source_post_source add value 'approved_variant';
  end if;
exception
  when undefined_object then
    -- The enum doesn't exist as its own type — likely source is a
    -- plain text column with a check constraint instead. In that
    -- case nothing to do; the app just writes the new value and
    -- the check constraint (if any) must be relaxed separately.
    null;
end $$;
