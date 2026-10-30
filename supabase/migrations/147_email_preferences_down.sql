-- 147 down · remove email preferences and restore migration 146's enqueue_weekly_digest. Undoes 147.
begin;
drop function if exists public.set_my_weekly_digest(boolean);
drop function if exists public.my_email_preferences();
drop function if exists public.unsubscribe_by_token(text);

-- enqueue_weekly_digest exactly as 146 shipped it (no opt-out, no unsubscribe token).
create or replace function public.enqueue_weekly_digest(
  p_society_id     text,
  p_day            date,
  p_compliance_due integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c     jsonb;
  v_admin record;
  v_name  text;
  v_week  text;
  v_key   text;
  v_n     integer := 0;
begin
  if p_society_id is null or p_day is null or p_compliance_due is null or p_compliance_due not between 0 and 99 then
    raise exception 'enqueue_weekly_digest: bad arguments';
  end if;
  v_c := public.weekly_digest_counts(p_society_id, p_day);
  -- no activity and nothing due → no email
  if (v_c ->> 'vouchers_week')::integer = 0 and (v_c ->> 'pending_approval')::integer = 0 and p_compliance_due = 0 then
    return 0;
  end if;
  v_name := public.notify_society_name(p_society_id);
  v_week := to_char(p_day, 'IYYY-"W"IW');
  for v_admin in
    select distinct on (lower(su.email)) lower(su.email) as email, su.name
      from public.society_users su
     where su.society_id::text = p_society_id and su.role = 'admin' and su.is_active
       and coalesce(trim(su.email), '') <> ''
     order by lower(su.email), su.created_at
  loop
    v_key := 'weekly_digest:' || p_society_id || ':' || v_admin.email || ':' || v_week;
    continue when exists (select 1 from public.notification_outbox where idempotency_key = v_key);
    perform public.enqueue_notification(
      p_society_id, 'weekly_digest', v_admin.email,
      jsonb_build_object(
        'name', v_admin.name, 'society_name', v_name, 'week', v_week,
        'period_from', (p_day - 7)::text, 'period_to', (p_day - 1)::text,
        'pending_approval', (v_c ->> 'pending_approval')::integer,
        'vouchers_week', (v_c ->> 'vouchers_week')::integer,
        'days_since_last', (v_c -> 'days_since_last'),
        'compliance_due', p_compliance_due,
        'unverified_users', (v_c ->> 'unverified_users')::integer),
      v_key);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke execute on function public.enqueue_weekly_digest(text, date, integer) from public, anon, authenticated;
grant execute on function public.enqueue_weekly_digest(text, date, integer) to service_role;

drop function if exists public.email_unsubscribe_token(text);
drop table if exists public.email_preferences;
delete from public.app_migrations where version = '147';
commit;
notify pgrst, 'reload schema';
