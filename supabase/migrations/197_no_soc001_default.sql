-- 197 · DB-04 (product audit 2026-11-17) — no table defaults society_id to the pseudo-tenant 'SOC001' any more.
--
-- WHY: 85 tables declared society_id text not null default 'SOC001'. A server-side insert that forgot society_id
-- did not fail — it landed silently in a shared tenant 'SOC001' that no society owns (prod 2026-11-22: no societies row
-- 'SOC001'; 377 orphan accounts rows and 9 account_reclass_log rows already sit there, a copy of the standard chart with
-- no openings and no vouchers). Dropping the default turns that silent misroute into a loud NOT NULL error.
--
-- SAFE (checked read-only on prod 2026-11-22): every function that inserts into these tables sets society_id itself
-- (post_voucher, save_pending_voucher, register_society, the edge functions' audit_log rows); the app always sends it
-- (RLS insert policies require it anyway). Same rule payroll already enforces (pay_core.tg_require_tenant).
-- The orphan 'SOC001' rows are NOT touched here (removing data is a separate decision).
-- Undo: 197_no_soc001_default_down.sql.
begin;

do $$
declare r record; n int := 0;
begin
  for r in
    select c.table_name from information_schema.columns c
     where c.table_schema = 'public' and c.column_name = 'society_id' and c.column_default ilike '%SOC001%'
  loop
    execute format('alter table public.%I alter column society_id drop default', r.table_name);
    n := n + 1;
  end loop;
  raise notice '197: dropped the SOC001 default on % tables', n;
end $$;

insert into public.app_migrations (version, name) values ('197', 'no_soc001_default')
  on conflict (version) do nothing;

commit;

-- VERIFY (expect: still_defaulted = 0 | mig = 1):
--   select (select count(*) from information_schema.columns where table_schema = 'public' and column_name = 'society_id'
--             and column_default ilike '%SOC001%') as still_defaulted,
--          (select count(*) from public.app_migrations where version = '197') as mig;
