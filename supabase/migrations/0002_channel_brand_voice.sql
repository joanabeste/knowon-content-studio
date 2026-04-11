-- =====================================================================
-- Channel-specific brand voice overrides
-- Stores per-channel tone, length rules, CTA style, do's/don'ts that
-- extend the general brand_voice row. Merged into the OpenAI system
-- prompt at generation time.
-- =====================================================================

create table if not exists public.channel_brand_voice (
  channel channel primary key,
  tone text,                            -- e.g. "professionell-persönlich, Hook in den ersten 2 Zeilen"
  length_guideline text,                -- e.g. "600-1500 Zeichen, 3-5 Hashtags"
  cta_style text,                       -- e.g. "subtil, Link im Kommentar oder am Ende"
  specific_dos text[] default '{}',
  specific_donts text[] default '{}',
  notes text,                           -- freeform additional guidance
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

-- Seed empty rows for all 5 channels so the UI can always render them
insert into public.channel_brand_voice (channel) values
  ('linkedin'),
  ('instagram'),
  ('eyefox'),
  ('newsletter'),
  ('blog')
on conflict (channel) do nothing;

-- ---------- RLS ----------
alter table public.channel_brand_voice enable row level security;

drop policy if exists channel_brand_voice_read on public.channel_brand_voice;
create policy channel_brand_voice_read on public.channel_brand_voice
  for select to authenticated using (true);

drop policy if exists channel_brand_voice_admin_write on public.channel_brand_voice;
create policy channel_brand_voice_admin_write on public.channel_brand_voice
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
