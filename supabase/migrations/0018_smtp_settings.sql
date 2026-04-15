-- SMTP credentials (single-row config)
--
-- A minimal settings table for the future email-notification
-- feature. No Supabase-native email send logic yet — this table
-- only persists the config so the user can fill it in and come
-- back later. The `id = 1` singleton pattern mirrors the existing
-- `brand_voice` table.

create table if not exists public.smtp_config (
  id int primary key default 1,
  host text,
  port int,
  username text,
  password text,
  from_name text,
  from_email text,
  secure boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint smtp_config_singleton check (id = 1)
);

insert into public.smtp_config (id)
values (1)
on conflict (id) do nothing;

alter table public.smtp_config enable row level security;

-- Only admins can read or write SMTP credentials — they contain a
-- password. Non-admin profiles should never see the table.
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
