-- One-off journal heal · Assandh (ddcb71c2) · JV/2026/27/2384 (voucher d5ff9f4e-…).
--
-- The voucher was edited on 2026-10-02 (credit 4400 Other Income → 4405 Misc). The vouchers row saved,
-- but the edit's journal append was refused (RLS 42501 — see migration 097), so ledger_events still holds
-- only the original posting (seq 1: Dr 4eaa2c73 / Cr 4400, ₹6,954.87). This appends what the edit
-- should have written: a reversal of that posting (seq 2) and a repost on the current legs (seq 3).
-- Append-only (nothing is updated or deleted). Idempotent: does nothing if seq > 1 already exists or
-- the voucher no longer matches the expected legs.
--
-- Run in Supabase SQL Editor (production). Expect: the insert returns 2 rows (0 on a re-run), then the
-- check shows 4eaa2c73 = +695487, 4405 = −695487, 4400 = 0.

with p as (
  select * from public.ledger_events
   where aggregate_type = 'voucher' and aggregate_id = 'd5ff9f4e-41ce-4915-97a1-33446f734fac'
     and event_type = 'voucher.posted' and sequence = 1
), v as (
  select * from public.vouchers
   where id = 'd5ff9f4e-41ce-4915-97a1-33446f734fac'
     and "debitAccountId" = '4eaa2c73-4d62-4424-b9b8-1cdb7b7fd2c3' and "creditAccountId" = '4405'
     and amount = 6954.87 and coalesce("isDeleted", false) = false
), guard as (
  select 1 from p, v
   where not exists (select 1 from public.ledger_events e
                      where e.aggregate_id = 'd5ff9f4e-41ce-4915-97a1-33446f734fac' and e.sequence > 1)
)
insert into public.ledger_events
  (event_id, event_type, schema_version, society_id, jurisdiction, aggregate_type, aggregate_id,
   sequence, occurred_at, producer_kind, producer_id, on_behalf_of, reversal_of, payload)
select gen_random_uuid()::text, 'voucher.reversed', p.schema_version, p.society_id, p.jurisdiction,
       'voucher', p.aggregate_id, 2, now(), 'human', 'heal-2026-10-02-jv2384', null, p.event_id,
       (p.payload - 'lines') || jsonb_build_object('reason', 'edit', 'lines',
         (select jsonb_agg(jsonb_set(l, '{drCr}', to_jsonb(case when l->>'drCr' = 'Dr' then 'Cr' else 'Dr' end)))
            from jsonb_array_elements(p.payload->'lines') l))
  from p, guard
union all
select gen_random_uuid()::text, 'voucher.reposted', p.schema_version, p.society_id, p.jurisdiction,
       'voucher', p.aggregate_id, 3, now(), 'human', 'heal-2026-10-02-jv2384', null, null,
       (p.payload - 'lines') || jsonb_build_object('lines', jsonb_build_array(
         jsonb_build_object('accountId', '4eaa2c73-4d62-4424-b9b8-1cdb7b7fd2c3', 'drCr', 'Dr', 'amountMinor', 695487),
         jsonb_build_object('accountId', '4405', 'drCr', 'Cr', 'amountMinor', 695487)))
  from p, guard
returning sequence, event_type, payload->'lines' as lines;

-- Check: net per account for this voucher.
select l->>'accountId' as account,
       sum(case when l->>'drCr' = 'Dr' then (l->>'amountMinor')::bigint else -(l->>'amountMinor')::bigint end) as net_paise
  from public.ledger_events e, jsonb_array_elements(e.payload->'lines') l
 where e.aggregate_id = 'd5ff9f4e-41ce-4915-97a1-33446f734fac'
 group by 1 order by 1;
