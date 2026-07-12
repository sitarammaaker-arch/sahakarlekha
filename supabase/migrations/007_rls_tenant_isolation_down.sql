-- ============================================================================
-- P1-SEC-1b · ROLLBACK — restore the pre-007 permissive posture
-- ============================================================================
-- Reverses 007_rls_tenant_isolation.sql: drops the tenant-scoped policies 007
-- created and re-opens access with permissive policies, so the application works
-- immediately if 007 must be rolled back (e.g. an unexpected access regression).
--
-- Notes:
--   • 001's own scoped, role-based policies (on vouchers/accounts/members/… ) are
--     NOT dropped by 007 and NOT restored here — they were never removed. Because
--     permissive policies are OR-combined, re-adding a permissive policy fully
--     restores access regardless.
--   • WORM is preserved even on rollback: ledger_events + audit_log get permissive
--     SELECT+INSERT only — no UPDATE/DELETE policy is recreated.
--   • RLS stays ENABLED (as it was before 007); only the policies change. This is
--     the safe rollback: re-open access without disabling row security wholesale.
-- ============================================================================

begin;

do $$
declare
  tbl   text;
  worm  text[] := array['ledger_events', 'audit_log'];
  is_worm boolean;
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
    order by c.relname
  loop
    is_worm := tbl = any(worm);

    -- drop the policies 007 created
    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_select', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_insert', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_update', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_delete', tbl);

    -- restore permissive access (idempotent names distinct from any originals)
    execute format('drop policy if exists %I on public.%I', tbl || '_rollback_select', tbl);
    execute format('create policy %I on public.%I for select using (true)', tbl || '_rollback_select', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_rollback_insert', tbl);
    execute format('create policy %I on public.%I for insert with check (true)', tbl || '_rollback_insert', tbl);

    if not is_worm then
      execute format('drop policy if exists %I on public.%I', tbl || '_rollback_update', tbl);
      execute format('create policy %I on public.%I for update using (true)', tbl || '_rollback_update', tbl);
      execute format('drop policy if exists %I on public.%I', tbl || '_rollback_delete', tbl);
      execute format('create policy %I on public.%I for delete using (true)', tbl || '_rollback_delete', tbl);
    end if;
    -- WORM: intentionally NO update/delete policy recreated (append-only preserved).
  end loop;
end $$;

-- societies: drop 007's id-scoped policies, restore permissive select+update.
do $$
begin
  drop policy if exists societies_tenant_select on public.societies;
  drop policy if exists societies_tenant_update on public.societies;
  drop policy if exists societies_rollback_select on public.societies;
  create policy societies_rollback_select on public.societies for select using (true);
  drop policy if exists societies_rollback_update on public.societies;
  create policy societies_rollback_update on public.societies for update using (true);
end $$;

commit;
