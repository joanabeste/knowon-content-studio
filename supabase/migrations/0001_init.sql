-- =====================================================================
-- KnowOn Marketing Content Platform — initial schema
-- Run this in the Supabase SQL Editor (or via `supabase db push`).
-- =====================================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ---------- Enums ----------
do $$ begin
  create type user_role as enum ('admin','editor','reviewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type channel as enum ('linkedin','instagram','eyefox','newsletter','blog');
exception when duplicate_object then null; end $$;

do $$ begin
  create type variant_status as enum ('draft','in_review','approved','published');
exception when duplicate_object then null; end $$;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role user_role not null default 'editor',
  created_at timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'editor'::user_role)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: is current user an admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.current_role_is(role_check user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = role_check
  );
$$;

-- ---------- brand_voice (singleton) ----------
create table if not exists public.brand_voice (
  id int primary key default 1,
  tone text,
  audience text,
  dos text[] default '{}',
  donts text[] default '{}',
  about_knowon text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  constraint brand_voice_singleton check (id = 1)
);

insert into public.brand_voice (id) values (1) on conflict (id) do nothing;

-- ---------- golden_examples ----------
create table if not exists public.golden_examples (
  id uuid primary key default gen_random_uuid(),
  channel channel not null,
  title text,
  body text not null,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create index if not exists golden_examples_channel_idx on public.golden_examples(channel);

-- ---------- source_posts ----------
create table if not exists public.source_posts (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('wordpress','manual','csv')),
  external_id text,
  url text,
  title text,
  body text not null,
  published_at timestamptz,
  imported_at timestamptz not null default now(),
  tags text[] default '{}',
  unique (source, external_id)
);

create index if not exists source_posts_published_idx on public.source_posts(published_at desc nulls last);

-- ---------- content_projects ----------
create table if not exists public.content_projects (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  brief text,
  status variant_status not null default 'draft',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_projects_created_idx on public.content_projects(created_at desc);

-- ---------- content_variants ----------
create table if not exists public.content_variants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.content_projects(id) on delete cascade,
  channel channel not null,
  version int not null default 1,
  body text not null,
  metadata jsonb,
  status variant_status not null default 'draft',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, channel, version)
);

create index if not exists content_variants_project_idx on public.content_variants(project_id);

-- ---------- images ----------
create table if not exists public.images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.content_projects(id) on delete cascade,
  prompt text not null,
  storage_path text not null,
  wp_media_id int,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- integrations (singleton, encrypted secrets) ----------
create table if not exists public.integrations (
  id int primary key default 1,
  wp_base_url text,
  wp_username text,
  wp_app_password_encrypted bytea,
  brevo_api_key_encrypted bytea,
  brevo_sender_email text,
  brevo_sender_name text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  constraint integrations_singleton check (id = 1)
);

insert into public.integrations (id) values (1) on conflict (id) do nothing;

-- ---------- audit_log ----------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor uuid references public.profiles(id),
  action text not null,
  target_type text,
  target_id uuid,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log(created_at desc);

-- =====================================================================
-- Row Level Security
-- =====================================================================

alter table public.profiles          enable row level security;
alter table public.brand_voice       enable row level security;
alter table public.golden_examples   enable row level security;
alter table public.source_posts      enable row level security;
alter table public.content_projects  enable row level security;
alter table public.content_variants  enable row level security;
alter table public.images            enable row level security;
alter table public.integrations      enable row level security;
alter table public.audit_log         enable row level security;

-- profiles: all authed users can read; only admin can update role; users can update their own full_name
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- brand_voice: read all, write admin only
drop policy if exists brand_voice_read on public.brand_voice;
create policy brand_voice_read on public.brand_voice
  for select to authenticated using (true);
drop policy if exists brand_voice_admin_write on public.brand_voice;
create policy brand_voice_admin_write on public.brand_voice
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- golden_examples: read all, write admin only
drop policy if exists golden_read on public.golden_examples;
create policy golden_read on public.golden_examples
  for select to authenticated using (true);
drop policy if exists golden_admin_write on public.golden_examples;
create policy golden_admin_write on public.golden_examples
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- source_posts: read all, write admin only
drop policy if exists sources_read on public.source_posts;
create policy sources_read on public.source_posts
  for select to authenticated using (true);
drop policy if exists sources_admin_write on public.source_posts;
create policy sources_admin_write on public.source_posts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- content_projects: all authed read; editor/admin create; owner or admin update; admin delete
drop policy if exists projects_read on public.content_projects;
create policy projects_read on public.content_projects
  for select to authenticated using (true);

drop policy if exists projects_insert on public.content_projects;
create policy projects_insert on public.content_projects
  for insert to authenticated
  with check (
    public.is_admin() or public.current_role_is('editor')
  );

drop policy if exists projects_update on public.content_projects;
create policy projects_update on public.content_projects
  for update to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());

drop policy if exists projects_delete on public.content_projects;
create policy projects_delete on public.content_projects
  for delete to authenticated using (public.is_admin());

-- content_variants: all read; editor/admin write; reviewer can update status only
drop policy if exists variants_read on public.content_variants;
create policy variants_read on public.content_variants
  for select to authenticated using (true);

drop policy if exists variants_insert on public.content_variants;
create policy variants_insert on public.content_variants
  for insert to authenticated
  with check (public.is_admin() or public.current_role_is('editor'));

drop policy if exists variants_update on public.content_variants;
create policy variants_update on public.content_variants
  for update to authenticated
  using (
    public.is_admin()
    or public.current_role_is('editor')
    or public.current_role_is('reviewer')
  )
  with check (
    public.is_admin()
    or public.current_role_is('editor')
    or public.current_role_is('reviewer')
  );

drop policy if exists variants_delete on public.content_variants;
create policy variants_delete on public.content_variants
  for delete to authenticated using (public.is_admin());

-- images: same as projects
drop policy if exists images_read on public.images;
create policy images_read on public.images
  for select to authenticated using (true);
drop policy if exists images_insert on public.images;
create policy images_insert on public.images
  for insert to authenticated
  with check (public.is_admin() or public.current_role_is('editor'));
drop policy if exists images_update on public.images;
create policy images_update on public.images
  for update to authenticated
  using (public.is_admin() or public.current_role_is('editor'))
  with check (public.is_admin() or public.current_role_is('editor'));
drop policy if exists images_delete on public.images;
create policy images_delete on public.images
  for delete to authenticated using (public.is_admin());

-- integrations: admin only everything
drop policy if exists integrations_admin on public.integrations;
create policy integrations_admin on public.integrations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- audit_log: admin read, all authed can insert (for server actions)
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log
  for select to authenticated using (public.is_admin());
drop policy if exists audit_insert on public.audit_log;
create policy audit_insert on public.audit_log
  for insert to authenticated with check (true);

-- =====================================================================
-- Storage bucket for generated images
-- Run this once manually in Supabase dashboard OR via the CLI:
--   insert into storage.buckets (id, name, public) values ('generated-images','generated-images', false) on conflict do nothing;
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('generated-images', 'generated-images', false)
on conflict (id) do nothing;

-- Policies for the bucket: authed users read/write their own uploads
drop policy if exists "generated_images_authed_read" on storage.objects;
create policy "generated_images_authed_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'generated-images');

drop policy if exists "generated_images_authed_insert" on storage.objects;
create policy "generated_images_authed_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'generated-images');

drop policy if exists "generated_images_authed_delete" on storage.objects;
create policy "generated_images_authed_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'generated-images' and public.is_admin());
