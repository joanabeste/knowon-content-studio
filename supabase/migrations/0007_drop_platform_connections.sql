-- =====================================================================
-- Drop the platform_connections table — LinkedIn + Instagram OAuth
-- integration has been removed from the app. Only WordPress is kept.
-- =====================================================================

drop policy if exists platform_connections_admin on public.platform_connections;
drop table if exists public.platform_connections;
