-- SahakarLekha — login read-load check (PROD, READ-ONLY). 2026-10-31.
-- Supabase SQL Editor → New query → paste ALL → Run. Nothing is written: the whole thing runs
-- inside a read-only transaction and ends with rollback. Each block returns one result row
-- (the editor shows only the LAST result, so run the blocks one at a time: select a block → Run).

-- ── Block 1: rows that ONE login pulls, per society (top 10 heaviest) ─────────────────────────
begin transaction read only;
with per_table as (
  select 'vouchers' t, society_id::text s, count(*) n from public.vouchers group by 2
  union all select 'ledger_events', society_id::text, count(*) from public.ledger_events group by 2
  union all select 'accounts', society_id::text, count(*) from public.accounts group by 2
  union all select 'members', society_id::text, count(*) from public.members group by 2
  union all select 'sales', society_id::text, count(*) from public.sales group by 2
  union all select 'purchases', society_id::text, count(*) from public.purchases group by 2
  union all select 'stock_movements', society_id::text, count(*) from public.stock_movements group by 2
)
select s as society_id,
       sum(n) as rows_per_login,
       max(n) filter (where t = 'vouchers') as vouchers,
       max(n) filter (where t = 'ledger_events') as ledger_events,
       max(n) filter (where t = 'accounts') as accounts
from per_table group by s order by 2 desc limit 10;
rollback;

-- ── Block 2: which queries the database spends its time on (since the last stats reset) ───────
begin transaction read only;
select left(regexp_replace(query, '\s+', ' ', 'g'), 120) as query,
       calls, round(total_exec_time::numeric) as total_ms, round(mean_exec_time::numeric, 1) as mean_ms,
       rows, shared_blks_read as disk_blocks_read
from extensions.pg_stat_statements
order by total_exec_time desc limit 15;
rollback;

-- ── Block 3: full-table scans vs index scans on the big tables ─────────────────────────────────
begin transaction read only;
select relname, seq_scan, seq_tup_read, idx_scan, n_live_tup
from pg_stat_user_tables
where relname in ('vouchers','ledger_events','sales','purchases','members','accounts','stock_movements','voucher_entries','voucher_lines')
order by seq_tup_read desc;
rollback;

-- ── Block 4: background-job tables that grow every minute (send-worker runs * * * * *) ─────────
begin transaction read only;
select (select count(*) from cron.job_run_details) as cron_run_rows,
       (select pg_size_pretty(pg_total_relation_size('cron.job_run_details'))) as cron_run_size,
       (select count(*) from net._http_response) as pg_net_response_rows,
       (select pg_size_pretty(pg_total_relation_size('net._http_response'))) as pg_net_response_size;
rollback;

-- ── Block 5: the real indexes on the login tables + since when Block 2's stats are counted ─────
begin transaction read only;
select tablename, indexname, indexdef,
       (select stats_reset::text from extensions.pg_stat_statements_info) as stats_since
from pg_indexes
where schemaname = 'public'
  and tablename in ('accounts','vouchers','ledger_events','stock_movements','members','sales','purchases')
order by tablename, indexname;
rollback;
