-- 092 undo · removes the nightly drift check and restores 091's _fy_balances body exactly.

begin;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- nested: cron.job must not even be parsed when pg_cron is absent
    if exists (select 1 from cron.job where jobname = 'nightly-ledger-drift') then
      perform cron.unschedule('nightly-ledger-drift');
    end if;
  end if;
end $cron$;
drop function if exists public.log_ledger_drift();
drop function if exists public.ledger_drift(text);
CREATE OR REPLACE FUNCTION public._fy_balances(p_sid text, p_as_of date)
 RETURNS TABLE(account_id text, net bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with legs as (
    select l ->> 'accountId' acc, round((case when l ->> 'type' = 'Dr' then 1 else -1 end) * (l ->> 'amount')::numeric * 100)::bigint n
      from public.vouchers v, jsonb_array_elements(v.lines) l
     where v.society_id::text = p_sid and jsonb_typeof(v.lines) = 'array' and jsonb_array_length(v.lines) > 0
       and not coalesce(v."isDeleted", false) and coalesce(v."approvalStatus", '') not in ('pending', 'rejected')
       and substr(v.date, 1, 10)::date <= p_as_of
    union all
    select x.acc, x.n
      from public.vouchers v
      cross join lateral (values (v."debitAccountId", round(v.amount * 100)::bigint), (v."creditAccountId", -round(v.amount * 100)::bigint)) x(acc, n)
     where v.society_id::text = p_sid and not (jsonb_typeof(v.lines) = 'array' and jsonb_array_length(v.lines) > 0)
       and not coalesce(v."isDeleted", false) and coalesce(v."approvalStatus", '') not in ('pending', 'rejected')
       and substr(v.date, 1, 10)::date <= p_as_of
    union all
    select a.id, round(coalesce(a."openingBalance", 0) * 100 * case when a."openingBalanceType" = 'credit' then -1 else 1 end)::bigint
      from public.accounts a where a.society_id::text = p_sid and not coalesce(a."isGroup", false)
  )
  select acc, sum(n)::bigint from legs where acc is not null group by acc;
$function$;

delete from public.app_migrations where version = '092';

commit;
