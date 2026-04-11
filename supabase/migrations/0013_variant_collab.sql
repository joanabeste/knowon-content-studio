-- Team-collaboration fields on variants + internal notes thread
--
-- Up to now content_variants tracked the reviewer (reviewed_by /
-- reviewed_at) but not the original author — that lived only on the
-- parent project. For per-variant attribution ("who wrote the
-- Instagram version?") we need created_by and updated_by on the
-- variant row itself.
--
-- The notes thread gives the team a place to leave internal comments
-- on a specific channel variant without touching the body ("still
-- needs a CTA", "checked with legal, go").

-- ---------------------------------------------------------------
-- 1. Variant author / updater tracking
-- ---------------------------------------------------------------

alter table public.content_variants
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.content_variants
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

-- Backfill created_by for historic rows from the parent project's
-- creator, so existing variants get an author after the schema change
-- instead of showing "—" in the UI forever.
update public.content_variants v
set created_by = p.created_by
from public.content_projects p
where v.project_id = p.id
  and v.created_by is null;

-- ---------------------------------------------------------------
-- 2. Internal notes thread
-- ---------------------------------------------------------------

create table if not exists public.variant_notes (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.content_variants(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists variant_notes_variant_id_idx
  on public.variant_notes (variant_id, created_at desc);

-- RLS: any authenticated team member can read + write notes.
-- Deletes are restricted to the note author (admins can delete
-- anything through the service role path in application code).
alter table public.variant_notes enable row level security;

drop policy if exists "variant_notes: authenticated read" on public.variant_notes;
create policy "variant_notes: authenticated read"
  on public.variant_notes for select
  to authenticated
  using (true);

drop policy if exists "variant_notes: authenticated insert" on public.variant_notes;
create policy "variant_notes: authenticated insert"
  on public.variant_notes for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "variant_notes: delete own" on public.variant_notes;
create policy "variant_notes: delete own"
  on public.variant_notes for delete
  to authenticated
  using (created_by = auth.uid());
