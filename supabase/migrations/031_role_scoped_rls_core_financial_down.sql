-- 031 down · undo the core-table split — collapse the 4 command policies back into ONE `society_rw`
--            FOR ALL policy, restoring the exact pre-031 behaviour (tenant-only, no role gate).
-- Reads the tenant predicate back from the surviving *_tenant_select policy, so the exact expression
-- (society_id IN current_user_society_ids()) is reused verbatim — never guessed. Run this at once if,
-- right after 031, the app cannot read or save vouchers/members/etc.

do $$
declare
  t text;
  q text;
  tbls text[] := array[
    'vouchers','members','accounts','sales','purchases','stock_items','stock_movements'
  ];
begin
  foreach t in array tbls loop
    select qual into q
    from pg_policies
    where schemaname = 'public' and tablename = t and policyname = t || '_tenant_select';
    if q is null then
      continue;   -- already collapsed (or never split) — skip
    end if;

    execute format('drop policy if exists %I on public.%I', t || '_tenant_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_tenant_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_tenant_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_tenant_delete', t);

    execute format('create policy %I on public.%I for all using (%s) with check (%s)',
      'society_rw', t, q, q);

    raise notice 'collapsed 4 policies back to society_rw FOR ALL on public.%', t;
  end loop;
end $$;
