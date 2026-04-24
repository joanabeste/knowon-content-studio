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
-- Idempotent + self-bootstrapping: handles all four possible states
--   a) table missing entirely → create it with password_encrypted
--   b) fresh install from 0018: column "password" exists → rename
--   c) partially migrated:      both columns exist → drop "password"
--   d) already migrated:        only "password_encrypted" exists → noop

-- Fresh-install safety net: older deployments used an earlier baseline
-- migration that created smtp_config. If 0018 was skipped (or the DB
-- is fresh and that migration hasn't run yet) we create the table
-- ourselves, so this migration can stand on its own.
create table if not exists public.smtp_config (
  id int primary key default 1,
  host text,
  port int,
  username text,
  from_name text,
  from_email text,
  secure boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint smtp_config_singleton check (id = 1)
);

insert into public.smtp_config (id) values (1) on conflict (id) do nothing;

alter table public.smtp_config enable row level security;

drop policy if exists "smtp_config: admin read" on public.smtp_config;
create policy "smtp_config: admin read"
  on public.smtp_config for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "smtp_config: admin update" on public.smtp_config;
create policy "smtp_config: admin update"
  on public.smtp_config for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (true);

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
