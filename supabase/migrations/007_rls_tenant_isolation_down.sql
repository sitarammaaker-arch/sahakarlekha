-- ============================================================================
-- P1-SEC-1b · ROLLBACK — FAITHFUL restore from the 007 policy snapshot (W-3)
-- ============================================================================
-- Reverses 007_rls_tenant_isolation.sql PRECISELY:
--   1. drops the tenant-scoped policies 007 created (*_tenant_* + societies_*),
--   2. re-creates EXACTLY the permissive policies 007 removed, from the
--      rls_policy_backup snapshot — nothing more.
--
-- This does NOT blanket-open every table (the previous version's flaw): a table
-- that was permissive before 007 gets its exact permissive policy back; a table
-- that was deny-all or scoped-only before 007 simply loses 007's tenant policies
-- and returns to that prior state. 001's own scoped policies were never dropped
-- by 007, so they remain. WORM stays append-only (its snapshot held only SELECT+
-- INSERT — no UPDATE/DELETE is restored).
--
-- Idempotent: drop-if-exists before every create; the snapshot restore is
-- de-duplicated to the latest backup per (table, policy). RLS stays ENABLED.
-- ============================================================================

begin;

-- 1) drop the policies 007 created (every society_id table + societies)
do $$
declare tbl text;
begin
  for tbl in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and exists (
        select 1 from pg_attribute a
        where a.attrelid = c.oid and a.attname = 'society_id'
          and a.attnum > 0 and not a.attisdropped
      )
  loop
    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_select', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_insert', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_update', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_delete', tbl);
  end loop;
  drop policy if exists societies_tenant_select on public.societies;
  drop policy if exists societies_tenant_update on public.societies;
end $$;

-- 2) restore EXACTLY the policies 007 removed, from the snapshot (latest per key)
do $$
declare r record;
begin
  for r in
    select distinct on (table_name, policy_name)
           table_name, policy_name, cmd, qual, with_check
    from rls_policy_backup
    order by table_name, policy_name, backed_up_at desc
  loop
    execute format('drop policy if exists %I on public.%I', r.policy_name, r.table_name);
    if r.cmd = 'SELECT' then
      execute format('create policy %I on public.%I for select using (%s)',
                     r.policy_name, r.table_name, coalesce(nullif(r.qual, ''), 'true'));
    elsif r.cmd = 'INSERT' then
      execute format('create policy %I on public.%I for insert with check (%s)',
                     r.policy_name, r.table_name, coalesce(nullif(r.with_check, ''), 'true'));
    elsif r.cmd = 'UPDATE' then
      execute format('create policy %I on public.%I for update using (%s) with check (%s)',
                     r.policy_name, r.table_name, coalesce(nullif(r.qual, ''), 'true'), coalesce(nullif(r.with_check, ''), 'true'));
    elsif r.cmd = 'DELETE' then
      execute format('create policy %I on public.%I for delete using (%s)',
                     r.policy_name, r.table_name, coalesce(nullif(r.qual, ''), 'true'));
    elsif r.cmd = 'ALL' then
      execute format('create policy %I on public.%I for all using (%s) with check (%s)',
                     r.policy_name, r.table_name, coalesce(nullif(r.qual, ''), 'true'), coalesce(nullif(r.with_check, ''), 'true'));
    end if;
  end loop;
end $$;

commit;
