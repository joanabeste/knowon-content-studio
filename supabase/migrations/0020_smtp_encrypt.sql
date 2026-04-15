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

alter table public.smtp_config
  rename column password to password_encrypted;

update public.smtp_config
set password_encrypted = null
where id = 1;
