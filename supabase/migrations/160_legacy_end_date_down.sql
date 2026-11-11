-- 160 down · legacy societies are indefinite again: restores refresh_subscription_status() (159 body, which
-- skips plan = 'legacy') and clears the 31-03-2027 end date this migration set.
-- A legacy society already moved to 'grace' / 'expired' is put back to 'active'.
begin;

create or replace function public.refresh_subscription_status()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_changed integer;
begin
  with next as (
    select society_id,
           case when now() >= period_end + interval '7 days' then 'expired' else 'grace' end as new_status
      from public.subscriptions
     where period_end is not null
       and period_end <= now()
       and plan <> 'legacy'
       and status <> 'expired'
  )
  update public.subscriptions s
     set status = n.new_status, updated_at = now()
    from next n
   where s.society_id = n.society_id
     and s.status is distinct from n.new_status;
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

revoke execute on function public.refresh_subscription_status() from public, anon, authenticated;
grant execute on function public.refresh_subscription_status() to service_role;

update public.subscriptions
   set period_end = null, status = 'active', updated_at = now()
 where plan = 'legacy'
   and period_end = timestamptz '2027-03-31 23:59:59+05:30';

delete from public.app_migrations where version = '160';

commit;

notify pgrst, 'reload schema';
