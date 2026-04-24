-- smtp_config braucht eine INSERT-Policy.
--
-- saveSmtpConfig() nutzt supabase.from('smtp_config').upsert({id:1, ...}).
-- Fällt die upsert-Logik auf INSERT zurück (weil die Singleton-Row noch
-- nicht existiert — z.B. wenn die DB frisch ohne Baseline-Seed aufgesetzt
-- wurde), scheitert sie an RLS mit "new row violates row-level security
-- policy for table smtp_config". Die Baseline-Policies decken nur SELECT
-- und UPDATE ab.

drop policy if exists "smtp_config: admin insert" on public.smtp_config;
create policy "smtp_config: admin insert"
  on public.smtp_config for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Safety-Net: Singleton-Row garantiert vorhanden, damit zukünftige Saves
-- deterministisch UPDATE statt INSERT machen.
insert into public.smtp_config (id)
values (1)
on conflict (id) do nothing;
