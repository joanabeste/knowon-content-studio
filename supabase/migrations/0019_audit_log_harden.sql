-- Harden the audit_log insert policy.
--
-- The original policy accepted `with check (true)` on insert, which
-- let any authenticated user write an audit_log row with ANY actor
-- uuid — i.e. spoof another team member into the log. That defeats
-- the point of an audit trail (a compromised editor could forge an
-- entry blaming an admin).
--
-- The fix: insert rows are only accepted when the `actor` matches
-- the caller's auth.uid(). Server actions that need to log on behalf
-- of the system should keep using the admin client (bypasses RLS).

drop policy if exists "audit_insert" on public.audit_log;
create policy "audit_insert" on public.audit_log
  for insert to authenticated
  with check (actor = auth.uid());
