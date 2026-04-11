-- =====================================================================
-- Safety migration: ensure platform_connections exists.
--
-- A previous commit dropped this table (migration 0007). That commit
-- was reverted — LinkedIn + Instagram OAuth are back. If you already
-- applied 0007 in Supabase and lost the table, running this migration
-- re-creates it. If the table still exists, this is a no-op.
-- =====================================================================

create table if not exists public.platform_connections (
  platform text primary key check (platform in ('linkedin','instagram')),
  access_token_encrypted text,
  refresh_token_encrypted text,
  expires_at timestamptz,
  external_id text,
  external_name text,
  scopes text[],
  connected_by uuid references public.profiles(id),
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.platform_connections enable row level security;

drop policy if exists platform_connections_admin on public.platform_connections;
create policy platform_connections_admin on public.platform_connections
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
