-- =====================================================================
-- Re-create platform_connections — third time's the charm.
--
-- History: 0004 created it, 0007 dropped, 0008 re-created (idempotent),
-- 0009 dropped again, 0010 re-creates it. The user wants LinkedIn +
-- Instagram OAuth back. This migration is idempotent: if the table
-- already exists (e.g. 0009 was never applied), it's a no-op.
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
