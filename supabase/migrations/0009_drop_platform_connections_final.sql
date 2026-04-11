-- =====================================================================
-- Final removal of platform_connections — LinkedIn + Instagram
-- integrations are not needed. This replaces the earlier idempotent
-- "ensure" migration 0008. Running this after 0008 is safe.
-- =====================================================================

drop policy if exists platform_connections_admin on public.platform_connections;
drop table if exists public.platform_connections;
