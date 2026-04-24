-- PostgREST schema cache auto-reload.
--
-- Supabase schickt PostgREST gewöhnlich einen "reload schema"-Notify,
-- sobald irgendwo im öffentlichen Schema ein DDL stattfindet. Manchen
-- älteren oder selbst-gehosteten Instanzen fehlt dieser Event-Trigger
-- — dann liefert die API weiterhin "Could not find the 'X' column of
-- 'Y' in the schema cache", obwohl die Spalte längst existiert.
--
-- Dieses Migrationsfile installiert den Trigger (falls nicht vorhanden)
-- und feuert am Ende einen harmlosen `comment on`-DDL, damit PostgREST
-- den Cache SOFORT aktualisiert. Von jetzt an reloadet jede Migration
-- den Cache automatisch.

create or replace function public.pgrst_watch()
returns event_trigger
language plpgsql
as $$
begin
  notify pgrst, 'reload schema';
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_event_trigger where evtname = 'pgrst_ddl_watch'
  ) then
    create event trigger pgrst_ddl_watch
      on ddl_command_end
      execute function public.pgrst_watch();
  end if;
end $$;

-- Dummy DDL, damit der Trigger jetzt greift und der Cache sich neu
-- aufbaut, ohne dass du im Dashboard einen Restart klicken musst.
comment on table public.smtp_config is 'settings: SMTP transport (singleton id=1)';

-- Plus ein direkter NOTIFY als Fallback.
notify pgrst, 'reload schema';
