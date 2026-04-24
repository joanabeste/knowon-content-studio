-- Baseline schema for KnowOn Marketing Content Studio.
--
-- This migration creates every table, enum and RLS policy that the
-- later migrations (0012+) assume already exists. It is a consolidated
-- "pre-0012" snapshot — everything added by 0012–0024 lives in those
-- files, not here.
--
-- Idempotent by design: `create ... if not exists` plus
-- `drop policy if exists` + `create policy` patterns, so re-running
-- this file against an already-migrated database is a no-op.

create extension if not exists pgcrypto;

-- =====================================================================
-- Enums
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'editor', 'reviewer');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'channel') then
    create type public.channel as enum (
      'linkedin',
      'instagram',
      'eyefox',
      'newsletter',
      'blog'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'variant_status') then
    create type public.variant_status as enum (
      'draft',
      'in_review',
      'approved',
      'published'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'source_post_source') then
    create type public.source_post_source as enum (
      'wordpress',
      'linkedin',
      'instagram',
      'eyefox',
      'newsletter',
      'url_import',
      'manual',
      'csv'
    );
  end if;
end $$;

-- =====================================================================
-- profiles
-- =====================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.user_role not null default 'editor',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
  on public.profiles for update
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin"
  on public.profiles for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Auto-create a profile row whenever a new auth.users row is inserted.
-- Role comes from raw_user_meta_data.role (set by the admin API) and
-- defaults to 'editor'. The team/actions.ts createUser() flow also
-- upserts the profile explicitly, so this trigger is a safety net for
-- self-signups or direct inserts.
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
    coalesce(new.raw_user_meta_data ->> 'full_name', null),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'editor')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- brand_voice (singleton id=1)
-- =====================================================================

create table if not exists public.brand_voice (
  id int primary key default 1,
  tone text,
  audience text,
  dos text[],
  donts text[],
  about_knowon text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint brand_voice_singleton check (id = 1)
);

insert into public.brand_voice (id) values (1) on conflict (id) do nothing;

alter table public.brand_voice enable row level security;

drop policy if exists "brand_voice_select_authenticated" on public.brand_voice;
create policy "brand_voice_select_authenticated"
  on public.brand_voice for select
  to authenticated
  using (true);

drop policy if exists "brand_voice_update_admin" on public.brand_voice;
create policy "brand_voice_update_admin"
  on public.brand_voice for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (true);

-- =====================================================================
-- channel_brand_voice
-- =====================================================================

create table if not exists public.channel_brand_voice (
  channel public.channel primary key,
  tone text,
  length_guideline text,
  cta_style text,
  specific_dos text[],
  specific_donts text[],
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

-- Seed one row per channel so the settings UI has tabs to show.
insert into public.channel_brand_voice (channel, updated_at)
values
  ('linkedin', now()),
  ('instagram', now()),
  ('eyefox', now()),
  ('newsletter', now()),
  ('blog', now())
on conflict (channel) do nothing;

alter table public.channel_brand_voice enable row level security;

drop policy if exists "channel_brand_voice_select_authenticated" on public.channel_brand_voice;
create policy "channel_brand_voice_select_authenticated"
  on public.channel_brand_voice for select
  to authenticated
  using (true);

drop policy if exists "channel_brand_voice_write_admin" on public.channel_brand_voice;
create policy "channel_brand_voice_write_admin"
  on public.channel_brand_voice for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- =====================================================================
-- content_projects
-- =====================================================================

create table if not exists public.content_projects (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  brief text,
  status public.variant_status not null default 'draft',
  requested_channels public.channel[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_projects_created_at_idx
  on public.content_projects (created_at desc);

create index if not exists content_projects_status_idx
  on public.content_projects (status);

alter table public.content_projects enable row level security;

drop policy if exists "content_projects_all_authenticated" on public.content_projects;
create policy "content_projects_all_authenticated"
  on public.content_projects for all
  to authenticated
  using (true)
  with check (true);

-- =====================================================================
-- content_variants
-- =====================================================================

create table if not exists public.content_variants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.content_projects(id) on delete cascade,
  channel public.channel not null,
  version int not null default 1,
  body text not null default '',
  metadata jsonb,
  status public.variant_status not null default 'draft',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, channel)
);

create index if not exists content_variants_project_id_idx
  on public.content_variants (project_id);

create index if not exists content_variants_status_idx
  on public.content_variants (status);

alter table public.content_variants enable row level security;

drop policy if exists "content_variants_all_authenticated" on public.content_variants;
create policy "content_variants_all_authenticated"
  on public.content_variants for all
  to authenticated
  using (true)
  with check (true);

-- =====================================================================
-- images
-- =====================================================================

create table if not exists public.images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.content_projects(id) on delete cascade,
  prompt text not null,
  storage_path text,
  wp_media_id bigint,
  is_featured boolean not null default false,
  size text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists images_project_id_idx
  on public.images (project_id, created_at desc);

alter table public.images enable row level security;

drop policy if exists "images_all_authenticated" on public.images;
create policy "images_all_authenticated"
  on public.images for all
  to authenticated
  using (true)
  with check (true);

-- =====================================================================
-- source_posts
-- =====================================================================

create table if not exists public.source_posts (
  id uuid primary key default gen_random_uuid(),
  source public.source_post_source not null,
  external_id text,
  url text,
  title text,
  body text not null,
  published_at timestamptz,
  imported_at timestamptz not null default now(),
  tags text[],
  channel public.channel not null,
  is_featured boolean not null default false
);

create index if not exists source_posts_channel_idx
  on public.source_posts (channel, imported_at desc);

create index if not exists source_posts_featured_idx
  on public.source_posts (is_featured, channel)
  where is_featured = true;

create unique index if not exists source_posts_source_external_uniq
  on public.source_posts (source, external_id)
  where external_id is not null;

alter table public.source_posts enable row level security;

drop policy if exists "source_posts_all_authenticated" on public.source_posts;
create policy "source_posts_all_authenticated"
  on public.source_posts for all
  to authenticated
  using (true)
  with check (true);

-- =====================================================================
-- audit_log
-- =====================================================================

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx
  on public.audit_log (created_at desc);

create index if not exists audit_log_actor_idx
  on public.audit_log (actor, created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "audit_select" on public.audit_log;
create policy "audit_select"
  on public.audit_log for select
  to authenticated
  using (true);

-- Harden insert directly (0019 later re-creates the same rule as a
-- safety net). Only the caller may write their own actor rows; the
-- server-side admin client bypasses RLS when it needs to log
-- system-authored events.
drop policy if exists "audit_insert" on public.audit_log;
create policy "audit_insert"
  on public.audit_log for insert
  to authenticated
  with check (actor = auth.uid());

-- =====================================================================
-- content_feeds
-- =====================================================================

create table if not exists public.content_feeds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  channel public.channel not null,
  is_active boolean not null default true,
  last_synced_at timestamptz,
  last_error text,
  items_count int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_feeds_channel_idx
  on public.content_feeds (channel);

alter table public.content_feeds enable row level security;

drop policy if exists "content_feeds_all_authenticated" on public.content_feeds;
create policy "content_feeds_all_authenticated"
  on public.content_feeds for all
  to authenticated
  using (true)
  with check (true);

-- =====================================================================
-- context_documents
-- =====================================================================

create table if not exists public.context_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  source text not null default 'manual',
  file_name text,
  is_active boolean not null default true,
  tags text[],
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists context_documents_active_idx
  on public.context_documents (is_active, created_at desc);

alter table public.context_documents enable row level security;

drop policy if exists "context_documents_all_authenticated" on public.context_documents;
create policy "context_documents_all_authenticated"
  on public.context_documents for all
  to authenticated
  using (true)
  with check (true);

-- =====================================================================
-- platform_connections (WordPress / LinkedIn / ... credentials)
-- =====================================================================

create table if not exists public.platform_connections (
  id uuid primary key default gen_random_uuid(),
  platform text not null unique,
  config jsonb not null default '{}'::jsonb,
  connected_by uuid references public.profiles(id) on delete set null,
  connected_at timestamptz not null default now()
);

alter table public.platform_connections enable row level security;

drop policy if exists "platform_connections_admin_only" on public.platform_connections;
create policy "platform_connections_admin_only"
  on public.platform_connections for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
