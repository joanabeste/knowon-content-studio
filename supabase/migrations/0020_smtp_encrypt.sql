-- Rename smtp_config.password → password_encrypted.
--
-- Previously the SMTP password was persisted in clear text. The field
-- was only added in 0018 and has (at worst) test data in it, so we
-- simply rename + wipe instead of migrating cleartext through
-- encrypt-on-upgrade.
--
-- The app writes into password_encrypted using AES-256-GCM via
-- src/lib/crypto.ts (INTEGRATIONS_ENCRYPTION_KEY). On read the
-- plaintext password is never returned to the client — the UI only
-- receives a `password_set` boolean so the form can show a
-- "konfiguriert" placeholder.
--
-- Idempotent: handles all three possible states
--   a) fresh install from 0018: column "password" exists → rename
--   b) partially migrated:      both columns exist → drop "password"
--   c) already migrated:        only "password_encrypted" exists → noop

do $$
declare
  has_pw boolean;
  has_enc boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'smtp_config'
      and column_name = 'password'
  ) into has_pw;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'smtp_config'
      and column_name = 'password_encrypted'
  ) into has_enc;

  if has_pw and not has_enc then
    alter table public.smtp_config
      rename column password to password_encrypted;
  elsif has_pw and has_enc then
    alter table public.smtp_config drop column password;
  elsif not has_pw and not has_enc then
    alter table public.smtp_config add column password_encrypted text;
  end if;
end $$;

-- Wipe any lingering (possibly cleartext) value so we never return
-- it to the client. The app will re-encrypt on next save.
update public.smtp_config
set password_encrypted = null
where id = 1;

-- PostgREST caches the table schema at startup. Without this notify
-- the API still returns "Could not find the 'password_encrypted'
-- column of 'smtp_config' in the schema cache" until the Supabase
-- Postgres instance is restarted. Sending the NOTIFY forces an
-- immediate cache refresh.
notify pgrst, 'reload schema';
