-- Fix: "Database error deleting user"
--
-- Root cause: deleting an auth.users row cascades to public.profiles,
-- but several tables have FK columns pointing at profiles(id) WITHOUT
-- an ON DELETE clause. Default is NO ACTION, which blocks the delete.
--
-- This migration walks a list of (table, column) pairs, drops any
-- existing FK constraint on that column that points at profiles, and
-- re-adds it with ON DELETE SET NULL so historic attribution is
-- preserved (as NULL) but the user can actually be removed.
--
-- Idempotent: safe to re-run. Skips tables/columns that don't exist,
-- so it also works on installations where the original migrations
-- that created these tables were partially applied.

do $$
declare
  rec record;
  con_name text;
  fk_tables text[] := array[
    'content_projects.created_by',
    'content_variants.reviewed_by',
    -- content_variants.created_by + updated_by were added in 0013
    -- with the right cascade, but include them for idempotency
    'content_variants.created_by',
    'content_variants.updated_by',
    'variant_notes.created_by',
    'images.created_by',
    'audit_log.actor',
    'brand_voice.updated_by',
    'channel_brand_voice.updated_by',
    'context_documents.created_by',
    'content_feeds.created_by',
    'platform_connections.connected_by'
  ];
  pair text;
  tbl text;
  col text;
begin
  foreach pair in array fk_tables loop
    tbl := split_part(pair, '.', 1);
    col := split_part(pair, '.', 2);

    -- Skip if the table or column doesn't exist in this installation
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = tbl
        and column_name = col
    ) then
      continue;
    end if;

    -- Find an existing FK constraint on that column pointing at profiles
    con_name := null;
    select c.conname into con_name
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    where n.nspname = 'public'
      and cl.relname = tbl
      and c.contype = 'f'
      and c.confrelid = 'public.profiles'::regclass
      and c.conkey[1] = (
        select a.attnum
        from pg_attribute a
        where a.attrelid = cl.oid and a.attname = col
      )
    limit 1;

    if con_name is not null then
      execute format('alter table public.%I drop constraint %I', tbl, con_name);
    end if;

    -- Re-add (or add for the first time) with ON DELETE SET NULL
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.profiles(id) on delete set null',
      tbl,
      tbl || '_' || col || '_fkey',
      col
    );
  end loop;
end $$;

-- Also make sure profiles → auth.users cascades. Supabase's default
-- template already does this, but when the original migrations were
-- accidentally wiped we may have lost it.
do $$
declare
  con_name text;
begin
  select c.conname into con_name
  from pg_constraint c
  join pg_class cl on cl.oid = c.conrelid
  join pg_namespace n on n.oid = cl.relnamespace
  where n.nspname = 'public'
    and cl.relname = 'profiles'
    and c.contype = 'f'
    and c.confrelid = 'auth.users'::regclass
  limit 1;

  if con_name is not null then
    execute format('alter table public.profiles drop constraint %I', con_name);
  end if;

  alter table public.profiles
    add constraint profiles_id_fkey
    foreign key (id) references auth.users(id) on delete cascade;
end $$;
