-- =====================================================================
-- Context documents (knowledge base for OpenAI prompts)
-- + Platform OAuth connections (LinkedIn, Instagram/Meta)
-- =====================================================================

-- ---------- context_documents ----------
-- Knowledge base entries (text or uploaded TXT/MD) that flow into
-- every generation as extra context. Active documents are included,
-- inactive ones are skipped.
create table if not exists public.context_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,                -- plain text / markdown
  source text not null default 'manual' check (source in ('manual','upload')),
  file_name text,                       -- original filename for uploads
  is_active boolean not null default true,
  tags text[] default '{}',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists context_documents_active_idx
  on public.context_documents(is_active);

alter table public.context_documents enable row level security;

drop policy if exists context_docs_read on public.context_documents;
create policy context_docs_read on public.context_documents
  for select to authenticated using (true);

drop policy if exists context_docs_insert on public.context_documents;
create policy context_docs_insert on public.context_documents
  for insert to authenticated
  with check (public.is_admin() or public.current_role_is('editor'));

drop policy if exists context_docs_update on public.context_documents;
create policy context_docs_update on public.context_documents
  for update to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());

drop policy if exists context_docs_delete on public.context_documents;
create policy context_docs_delete on public.context_documents
  for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- ---------- platform_connections ----------
-- Stores OAuth tokens for external platforms. Admin-only.
-- Secrets are stored encrypted using pgcrypto (AES) with a key
-- from the INTEGRATIONS_ENCRYPTION_KEY env var — we simply store
-- them as base64 strings and decrypt in the server action.
create table if not exists public.platform_connections (
  platform text primary key check (platform in ('linkedin','instagram')),
  access_token_encrypted text,          -- base64-encoded, encrypted via app
  refresh_token_encrypted text,
  expires_at timestamptz,
  external_id text,                     -- LinkedIn person URN, Instagram user ID
  external_name text,                   -- display name
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

-- =====================================================================
-- Storage bucket for uploaded context documents
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('context-documents', 'context-documents', false)
on conflict (id) do nothing;

drop policy if exists "context_documents_authed_read" on storage.objects;
create policy "context_documents_authed_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'context-documents');

drop policy if exists "context_documents_authed_insert" on storage.objects;
create policy "context_documents_authed_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'context-documents');

drop policy if exists "context_documents_authed_delete" on storage.objects;
create policy "context_documents_authed_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'context-documents' and public.is_admin());
