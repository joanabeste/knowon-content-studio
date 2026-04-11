-- =====================================================================
-- Simplify integrations secret storage: bytea → text
--
-- Why: the bytea roundtrip via Supabase-JS leads to encoding ambiguity
--   (hex-escape on write, hex-prefix string on read) which was causing
--   the WP app password to decrypt to garbage and fail with 401.
--
-- The app-level encryption (AES-256-GCM via lib/crypto.ts) returns a
-- base64 string which is binary-safe and fits cleanly in a text column.
-- =====================================================================

alter table public.integrations
  alter column wp_app_password_encrypted type text
  using null;  -- existing value was likely garbled, clear it

alter table public.integrations
  alter column brevo_api_key_encrypted type text
  using null;
