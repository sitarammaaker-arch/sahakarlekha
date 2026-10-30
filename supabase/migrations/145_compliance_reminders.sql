-- 145 · Compliance reminder emails (2026-10-30, email slice 4).
--
-- The compliance-reminders Edge Function (pg_cron, once a day) computes due items with the SAME engine as the
-- in-app calendar (src/lib/complianceCalendar.ts → _shared/compliance-core.mjs) and hands them to
-- enqueue_compliance_due. The database — never the caller — decides who receives them:
--   • compliance_reminder_targets()  one row per society that has an active admin with an email: name, state,
--                                    TAN / GSTIN present, any active employee, and the item ids already filed.
--   • enqueue_compliance_due(...)    for each item NOT filed (checked again here) → one 'compliance_due' email
--                                    per active admin (society_users, lower(email)), idempotent per
--                                    society + item + recipient + day. claim_outbox still sends only to
--                                    verified addresses.
-- The payload carries titles, the period, the due date, days left and a count — never an amount.
--
-- "Filed" tracking already exists: compliance_filings (tenant RLS; insert/update jwt_can_write, delete
-- jwt_can_delete — migration 030), written by the Compliance Calendar's "फाइल हुआ" button.
-- Both functions are service-role only. Additive. Undo: 145_compliance_reminders_down.sql.

begin;

create or replace function public.compliance_reminder_targets()
returns table (
  society_id    text,
  society_name  text,
  state         text,
  tan           boolean,
  gstin         boolean,
  has_employees boolean,
  filed_ids     text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with soc as (
    select distinct su.society_id::text as sid
      from public.society_users su
     where su.role = 'admin' and su.is_active and coalesce(trim(su.email), '') <> ''
  )
  select soc.sid,
         public.notify_society_name(soc.sid),
         coalesce(nullif(trim(ss.state), ''),
                  (select nullif(trim(s.state), '') from public.societies s where s.id::text = soc.sid limit 1)),
         coalesce(trim(ss.tan), '') <> '',
         coalesce(trim(ss.gstin), '') <> '',
         exists (select 1 from public.employees e where e.society_id::text = soc.sid and e.status = 'active'),
         coalesce((select array_agg(distinct cf."itemId") from public.compliance_filings cf
                    where cf.society_id::text = soc.sid and cf."itemId" is not null), '{}'::text[])
    from soc
    left join lateral (select * from public.society_settings x where x.society_id::text = soc.sid limit 1) ss on true;
$$;
revoke execute on function public.compliance_reminder_targets() from public, anon, authenticated;
grant execute on function public.compliance_reminder_targets() to service_role;

-- p_items: [{ id, rule_key, title, title_hi, period, due_date, days_left }]; p_pending_count: the society's
-- unfiled items due in the next 7 days. Returns the number of NEW outbox rows.
create or replace function public.enqueue_compliance_due(
  p_society_id    text,
  p_day           date,
  p_items         jsonb,
  p_pending_count integer default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item  jsonb;
  v_admin record;
  v_name  text := public.notify_society_name(p_society_id);
  v_key   text;
  v_n     integer := 0;
begin
  if p_society_id is null or p_day is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'enqueue_compliance_due: bad arguments';
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    if coalesce(v_item ->> 'id', '') !~ '^[a-z0-9-]{1,40}$'
       or coalesce(v_item ->> 'due_date', '') !~ '^\d{4}-\d{2}-\d{2}$'
       or coalesce(v_item ->> 'days_left', '') !~ '^-?\d{1,3}$' then
      raise exception 'enqueue_compliance_due: bad item %', v_item;
    end if;
    -- filed since the caller read the targets → no reminder
    continue when exists (select 1 from public.compliance_filings cf
                           where cf.society_id::text = p_society_id and cf."itemId" = v_item ->> 'id');
    for v_admin in
      select distinct on (lower(su.email)) lower(su.email) as email, su.name
        from public.society_users su
       where su.society_id::text = p_society_id and su.role = 'admin' and su.is_active
         and coalesce(trim(su.email), '') <> ''
       order by lower(su.email), su.created_at
    loop
      v_key := 'compliance_due:' || p_society_id || ':' || (v_item ->> 'id') || ':' || v_admin.email || ':' || p_day::text;
      continue when exists (select 1 from public.notification_outbox where idempotency_key = v_key);
      perform public.enqueue_notification(
        p_society_id, 'compliance_due', v_admin.email,
        jsonb_strip_nulls(jsonb_build_object(
          'name', v_admin.name, 'society_name', v_name,
          'item_id', v_item ->> 'id', 'rule_key', v_item ->> 'rule_key',
          'title', v_item ->> 'title', 'title_hi', v_item ->> 'title_hi', 'period', v_item ->> 'period',
          'due_date', v_item ->> 'due_date', 'days_left', (v_item ->> 'days_left')::integer,
          'pending_count', p_pending_count)),
        v_key);
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end;
$$;
revoke execute on function public.enqueue_compliance_due(text, date, jsonb, integer) from public, anon, authenticated;
grant execute on function public.enqueue_compliance_due(text, date, jsonb, integer) to service_role;

insert into public.app_migrations (version, name) values ('145', 'compliance_reminders')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: fns = 2 | anon_exec = 0 | mig = 1):
--   select (select count(*) from pg_proc where proname in ('compliance_reminder_targets', 'enqueue_compliance_due')) as fns,
--          (select count(*) from pg_proc p where p.proname in ('compliance_reminder_targets', 'enqueue_compliance_due')
--             and has_function_privilege('anon', p.oid, 'execute')) as anon_exec,
--          (select count(*) from public.app_migrations where version = '145') as mig;
