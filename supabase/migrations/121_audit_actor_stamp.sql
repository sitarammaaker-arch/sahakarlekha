-- 121 · audit_log: the actor is stamped by the SERVER, not trusted from the browser
--       (member-area re-audit 2026-10-17, stage B — H-4; founder decision: stamp, no second audit row).
--
-- WHY: audit_log is append-only (007), but its INSERT policy checks only the tenant, and actor_name / actor_email /
-- actor_role came from the client. Any user of a society could write a row naming someone else.
--
-- WHAT: a BEFORE INSERT trigger. When the insert carries a signed-in user's JWT (an email claim, not the service
-- role), actor_email := that email, actor_role := the JWT user_role, actor_name := that user's society_users.name.
-- Rows written by the service role (Edge Functions: member-portal-admin, ai-ask, scheduled jobs) or from the SQL
-- editor (no JWT) keep what they supply — those writers are server-side already.
-- Nothing else in the row changes; the app needs no change. Undo: 121_audit_actor_stamp_down.sql.

begin;

create or replace function public.audit_log_stamp_actor() returns trigger
  language plpgsql security definer set search_path to ''
as $$
declare
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_role  text := nullif(auth.jwt() ->> 'user_role', '');
  v_name  text;
begin
  if v_email is null or coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;
  select su.name into v_name
    from public.society_users su
   where lower(su.email) = v_email and su.society_id::text = new.society_id::text
   limit 1;
  new.actor_email := v_email;
  new.actor_role  := coalesce(v_role, new.actor_role);
  new.actor_name  := coalesce(nullif(v_name, ''), new.actor_name);
  return new;
end;
$$;

-- A trigger function: never callable through the API (firing a trigger does not need EXECUTE).
revoke execute on function public.audit_log_stamp_actor() from public, anon, authenticated;

drop trigger if exists audit_log_stamp_actor on public.audit_log;
create trigger audit_log_stamp_actor
  before insert on public.audit_log
  for each row execute function public.audit_log_stamp_actor();

insert into public.app_migrations (version, name) values ('121', 'audit_actor_stamp')
  on conflict (version) do nothing;

commit;

-- VERIFY: select tgname from pg_trigger where tgrelid = 'public.audit_log'::regclass and not tgisinternal;
--   → audit_log_stamp_actor
