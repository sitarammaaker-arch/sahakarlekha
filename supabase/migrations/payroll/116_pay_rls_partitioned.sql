-- =====================================================================================
-- Migration 116 — RLS policies for PARTITIONED pay_* tables (fixes a gap in 110).
-- -------------------------------------------------------------------------------------
-- BUG: 110's generic society/role policy loops filtered `relkind = 'r'` (ordinary tables), so
-- PARTITIONED parents (relkind = 'p' — pay_calc.payslip, payslip_line, pay_event, and the audit
-- tables) had RLS ENABLED + FORCED but NO policies. Effect: they were invisible AND unwritable to
-- authenticated (tenant) users — only service_role / superuser could reach them. The orchestrator
-- persists as superuser so it worked, but a real tenant UI user saw ZERO payslips (surfaced while
-- building the payroll UI read surface).
--
-- FIX: apply the same tenant SELECT + INSERT policies to every society-scoped partitioned parent
-- that is missing them. Idempotent (skips a policy that already exists). Additive + reversible.
-- WORM append is preserved (SELECT + INSERT only; the WORM trigger still blocks UPDATE/DELETE).
-- =====================================================================================

do $$
declare r record;
begin
  for r in
    select n.nspname as sch, c.relname as tbl
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname like 'pay\_%' and c.relkind = 'p'   -- partitioned parents only
      and exists (select 1 from pg_attribute a
                  where a.attrelid = c.oid and a.attname = 'society_id' and not a.attisdropped)
  loop
    if not exists (select 1 from pg_policies where schemaname = r.sch and tablename = r.tbl and policyname = r.tbl||'_sel') then
      execute format($f$create policy %I on %I.%I for select
        using (society_id = pay_core.current_society_uuid() or society_id is null)$f$, r.tbl||'_sel', r.sch, r.tbl);
    end if;
    if not exists (select 1 from pg_policies where schemaname = r.sch and tablename = r.tbl and policyname = r.tbl||'_ins') then
      execute format($f$create policy %I on %I.%I for insert
        with check (society_id = pay_core.current_society_uuid() and public.jwt_can_write())$f$, r.tbl||'_ins', r.sch, r.tbl);
    end if;
  end loop;
end$$;
