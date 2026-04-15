-- Project-level review workflow + AI-preview + variant versioning
--
-- This migration introduces three related capabilities:
--
-- 1. Project assignment & review state
--    ----------------------------------
--    `assigned_to`      — who is currently responsible for the project.
--                         Nullable. Gets updated on each transition.
--    `is_preview`       — true while the project is a draft generated
--                         by the AI preview flow, hidden from the main
--                         project list until the user hits "Übernehmen".
--    `review_requested_at` — stamp of when the project was last sent
--                         to review. For dashboard sorting / SLA.
--
-- 2. Variant version history
--    -----------------------
--    `variant_versions` archives previous bodies of a variant every
--    time it gets regenerated or modified by AI. The `version` column
--    on `content_variants` already existed as an int (unused). We now
--    bump it on every regenerate and push the old snapshot into
--    `variant_versions` so the team can restore.
--
-- 3. Cleanup metadata
--    -----------------
--    We don't auto-expire preview rows here (no pg_cron dependency);
--    the application cron endpoint will handle cleanup based on
--    created_at + is_preview.

alter table public.content_projects
  add column if not exists assigned_to uuid
    references public.profiles(id) on delete set null;

alter table public.content_projects
  add column if not exists is_preview boolean not null default false;

alter table public.content_projects
  add column if not exists review_requested_at timestamptz null;

create index if not exists content_projects_assigned_to_idx
  on public.content_projects (assigned_to)
  where assigned_to is not null;

create index if not exists content_projects_is_preview_idx
  on public.content_projects (is_preview)
  where is_preview = true;

-- ---------------------------------------------------------------
-- Variant version history
-- ---------------------------------------------------------------

create table if not exists public.variant_versions (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.content_variants(id) on delete cascade,
  version int not null,
  body text not null,
  metadata jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  -- "regenerate_channel" | "regenerate_all" | "apply_note" | "manual_edit"
  reason text not null
);

create index if not exists variant_versions_variant_id_idx
  on public.variant_versions (variant_id, version desc);

alter table public.variant_versions enable row level security;

drop policy if exists "variant_versions: authenticated read" on public.variant_versions;
create policy "variant_versions: authenticated read"
  on public.variant_versions for select
  to authenticated
  using (true);

drop policy if exists "variant_versions: authenticated insert" on public.variant_versions;
create policy "variant_versions: authenticated insert"
  on public.variant_versions for insert
  to authenticated
  with check (created_by = auth.uid());

-- ---------------------------------------------------------------
-- variant_notes: track which version a note was applied to
-- ---------------------------------------------------------------
--
-- When the "wand" feature incorporates a note into the variant body,
-- we record which new variant version the note was merged into. This
-- lets the UI show "✓ eingearbeitet in v3" next to the note and stops
-- users from applying the same note twice by accident.

alter table public.variant_notes
  add column if not exists applied_to_version int null;
