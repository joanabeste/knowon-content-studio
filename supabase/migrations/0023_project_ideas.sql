-- Ideen-Backlog (project_ideas)
--
-- Ein leichtgewichtiges Gegenstück zu content_projects: irgendwo
-- zwischen Notizzettel und echtem Projekt. Nutzer*innen werfen
-- hier schnell Themen rein — Title ist Pflicht, alles andere (Brief,
-- angedachte Kanäle, Ziel-Datum) optional. Aus einer Idee wird
-- später per Klick ein Projekt; der Link zurück (converted_to_project_id)
-- zeigt in der Liste an, dass die Idee bereits realisiert wurde.

create table if not exists public.project_ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  notes text,
  suggested_channels public.channel[],
  target_date timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  converted_to_project_id uuid references public.content_projects(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_ideas_created_at_idx
  on public.project_ideas (created_at desc);

create index if not exists project_ideas_archived_idx
  on public.project_ideas (archived_at)
  where archived_at is not null;

alter table public.project_ideas enable row level security;

-- Alle Team-Mitglieder dürfen Ideen sehen, anlegen und ändern;
-- Löschen nur für Autor*in oder Admin. Konsistent mit dem
-- kollaborativen Design der übrigen Tabellen.
drop policy if exists "project_ideas: authenticated read" on public.project_ideas;
create policy "project_ideas: authenticated read"
  on public.project_ideas for select
  to authenticated
  using (true);

drop policy if exists "project_ideas: authenticated insert" on public.project_ideas;
create policy "project_ideas: authenticated insert"
  on public.project_ideas for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "project_ideas: authenticated update" on public.project_ideas;
create policy "project_ideas: authenticated update"
  on public.project_ideas for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "project_ideas: author or admin delete" on public.project_ideas;
create policy "project_ideas: author or admin delete"
  on public.project_ideas for delete
  to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
