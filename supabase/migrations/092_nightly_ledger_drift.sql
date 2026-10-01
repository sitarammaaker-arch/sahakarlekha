-- 092 · nightly ledger-drift check for EVERY society (Phase-2 B7 / founder: "no per-society work").
--
-- ledger_drift(p_sid default null) — per society, how many accounts disagree (and by how many paise)
--   between the three copies of the books:
--     truth   = live, posted vouchers (their `lines`, else Dr/Cr/amount)
--     journal = ledger_events read EXACTLY as every statement reads them (resolveCurrentVouchers):
--               a cancelled voucher counts nothing; otherwise its latest voucher.reposted, else its
--               voucher.posted. (A raw sum of all events over-counts edits that appended a repost
--               without its reversal — Rania has such history; the statements were never affected.)
--     entries = voucher_entries of live, posted vouchers
--   Only societies with drift are returned. Read-only.
-- log_ledger_drift() — writes one error_log row (source 'ledger-drift') per drifting society, so drift is
--   seen the next morning instead of being found by hand; returns how many societies drifted.
-- pg_cron 'nightly-ledger-drift' runs it at 20:30 UTC (02:00 IST), when pg_cron is installed.
-- _fy_balances (091) is hardened: a voucher whose `lines` is NULL now counts through Dr/Cr/amount.
--
-- Not client-callable (service / cron / the read-only linked CLI). Idempotent.
-- Undo: 092_nightly_ledger_drift_down.sql.

begin;

create or replace function public.ledger_drift(p_sid text default null)
returns table (society_id text, journal_accounts int, journal_abs_minor bigint, entries_accounts int, entries_abs_minor bigint)
language sql stable security definer
set search_path = public as $fn$
  with v as (
    select v.* from public.vouchers v
     where (p_sid is null or v.society_id::text = p_sid)
       and not coalesce(v."isDeleted", false) and coalesce(v."approvalStatus", '') not in ('pending', 'rejected')
  ),
  truth as (
    select v.society_id::text sid, l ->> 'accountId' acc,
           sum(round((case when l ->> 'type' = 'Dr' then 1 else -1 end) * (l ->> 'amount')::numeric * 100))::bigint net
      from v, jsonb_array_elements(v.lines) l
     where coalesce(jsonb_array_length(case when jsonb_typeof(v.lines) = 'array' then v.lines end), 0) > 0
     group by 1, 2
    union all
    select v.society_id::text, x.acc, sum(x.n)::bigint
      from v cross join lateral (values (v."debitAccountId", round(v.amount * 100)::bigint), (v."creditAccountId", -round(v.amount * 100)::bigint)) x(acc, n)
     where coalesce(jsonb_array_length(case when jsonb_typeof(v.lines) = 'array' then v.lines end), 0) = 0
     group by 1, 2
  ),
  t as (select sid, acc, sum(net)::bigint net from truth group by 1, 2),
  ev as (
    select e.society_id::text sid, e.aggregate_id, e.event_type, e.sequence, e.payload from public.ledger_events e
     where e.aggregate_type = 'voucher' and (p_sid is null or e.society_id::text = p_sid)
  ),
  cur as (
    select distinct on (aggregate_id) sid, aggregate_id, payload from ev
     where event_type in ('voucher.posted', 'voucher.reposted')
       and aggregate_id not in (select aggregate_id from ev where event_type = 'voucher.cancelled')
     order by aggregate_id, (event_type = 'voucher.reposted') desc, sequence desc
  ),
  j as (
    select cur.sid, l ->> 'accountId' acc, sum((case when l ->> 'drCr' = 'Dr' then 1 else -1 end) * (l ->> 'amountMinor')::bigint)::bigint net
      from cur, jsonb_array_elements(coalesce(cur.payload -> 'lines', '[]'::jsonb)) l group by 1, 2
  ),
  en as (
    select ve.society_id::text sid, ve."accountId" acc, sum(round((ve.dr - ve.cr) * 100))::bigint net
      from public.voucher_entries ve join v on v.id = ve."voucherId" group by 1, 2
  ),
  accs as (select sid, acc from t union select sid, acc from j union select sid, acc from en),
  d as (
    select a.sid,
           count(*) filter (where coalesce(t.net, 0) <> coalesce(j.net, 0))::int ja,
           coalesce(sum(abs(coalesce(t.net, 0) - coalesce(j.net, 0))), 0)::bigint jm,
           count(*) filter (where coalesce(t.net, 0) <> coalesce(en.net, 0))::int ea,
           coalesce(sum(abs(coalesce(t.net, 0) - coalesce(en.net, 0))), 0)::bigint em
      from accs a left join t using (sid, acc) left join j using (sid, acc) left join en using (sid, acc)
     group by 1
  )
  select sid, ja, jm, ea, em from d where ja > 0 or ea > 0 order by sid;
$fn$;
revoke execute on function public.ledger_drift(text) from public, anon, authenticated;

create or replace function public.log_ledger_drift()
returns int language plpgsql security definer
set search_path = public as $fn$
declare r record; n int := 0;
begin
  for r in select * from public.ledger_drift(null) loop
    n := n + 1;
    insert into public.error_log (id, society_id, source, message, context, created_at)
    values (gen_random_uuid()::text, r.society_id, 'ledger-drift',
            format('हिसाब में अंतर: journal %s खाते (₹%s), entries %s खाते (₹%s) — heal-voucher-consistency चलाएँ',
                   r.journal_accounts, round(r.journal_abs_minor / 100.0, 2), r.entries_accounts, round(r.entries_abs_minor / 100.0, 2)),
            jsonb_build_object('journalAccounts', r.journal_accounts, 'journalAbsMinor', r.journal_abs_minor,
                               'entriesAccounts', r.entries_accounts, 'entriesAbsMinor', r.entries_abs_minor),
            now());
  end loop;
  return n;
end;
$fn$;
revoke execute on function public.log_ledger_drift() from public, anon, authenticated;

-- 091 hardening: a NULL `lines` falls through to Dr/Cr/amount (was dropped from both branches).
create or replace function public._fy_balances(p_sid text, p_as_of date)
returns table (account_id text, net bigint) language sql stable security definer
set search_path = public as $fn$
  with legs as (
    select l ->> 'accountId' acc, round((case when l ->> 'type' = 'Dr' then 1 else -1 end) * (l ->> 'amount')::numeric * 100)::bigint n
      from public.vouchers v, jsonb_array_elements(v.lines) l
     where v.society_id::text = p_sid and coalesce(jsonb_array_length(case when jsonb_typeof(v.lines) = 'array' then v.lines end), 0) > 0
       and not coalesce(v."isDeleted", false) and coalesce(v."approvalStatus", '') not in ('pending', 'rejected')
       and substr(v.date, 1, 10)::date <= p_as_of
    union all
    select x.acc, x.n
      from public.vouchers v
      cross join lateral (values (v."debitAccountId", round(v.amount * 100)::bigint), (v."creditAccountId", -round(v.amount * 100)::bigint)) x(acc, n)
     where v.society_id::text = p_sid and coalesce(jsonb_array_length(case when jsonb_typeof(v.lines) = 'array' then v.lines end), 0) = 0
       and not coalesce(v."isDeleted", false) and coalesce(v."approvalStatus", '') not in ('pending', 'rejected')
       and substr(v.date, 1, 10)::date <= p_as_of
    union all
    select a.id, round(coalesce(a."openingBalance", 0) * 100 * case when a."openingBalanceType" = 'credit' then -1 else 1 end)::bigint
      from public.accounts a where a.society_id::text = p_sid and not coalesce(a."isGroup", false)
  )
  select acc, sum(n)::bigint from legs where acc is not null group by acc;
$fn$;
revoke execute on function public._fy_balances(text, date) from public, anon, authenticated;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'nightly-ledger-drift') then
      perform cron.unschedule('nightly-ledger-drift');
    end if;
    perform cron.schedule('nightly-ledger-drift', '30 20 * * *', 'select public.log_ledger_drift()');
  end if;
end $cron$;

insert into public.app_migrations (version, name) values ('092', 'nightly_ledger_drift')
  on conflict (version) do nothing;

commit;
