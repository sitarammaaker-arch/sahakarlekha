-- 031 · role-scoped mutation RLS — the core FINANCIAL tables (vouchers, members, accounts, sales,
--        purchases, stock_items, stock_movements). Audit P0-3, Layer B / SB2 (highest-value).
--
-- These carry a SINGLE `society_rw` FOR ALL policy (tenant: society_id IN current_user_society_ids()),
-- so the tenant rule covers SELECT + every mutation together. To enforce role on WRITES without
-- touching READS, split that one policy into four command-scoped policies:
--   SELECT  → tenant only (every role in the society reads)
--   INSERT  → tenant AND jwt_can_write()   (admin + accountant)
--   UPDATE  → tenant AND jwt_can_write()
--   DELETE  → tenant AND jwt_can_delete()  (admin only)
--
-- ⚠️ HIGHEST BLAST RADIUS in the audit — a mistake breaks all read+write on the app's core data. So:
--   * the WHOLE thing runs in ONE transaction (atomic — any error rolls it all back);
--   * the tenant predicate is READ from pg_policies and reused verbatim (never guessed);
--   * idempotent — a table already split (no society_rw) is skipped;
--   * backward-compatible role checks (old tokens pass), so no logged-in user is locked out.
-- AFTER RUNNING: immediately open the app and confirm vouchers/members LOAD and a new entry SAVES.
-- If anything is off, run 031_..._down.sql (recreates the single FOR ALL policy) at once.

do $$
declare
  pol record;
  q text;    -- tenant USING
  wc text;   -- tenant WITH CHECK
  tbls text[] := array[
    'vouchers','members','accounts','sales','purchases','stock_items','stock_movements'
  ];
begin
  for pol in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public' and tablename = any(tbls)
      and cmd = 'ALL' and policyname = 'society_rw'
  loop
    q  := pol.qual;
    wc := coalesce(pol.with_check, pol.qual);

    execute format('drop policy %I on public.%I', pol.policyname, pol.tablename);

    execute format('create policy %I on public.%I for select using (%s)',
      pol.tablename || '_tenant_select', pol.tablename, q);

    execute format('create policy %I on public.%I for insert with check ((%s) and jwt_can_write())',
      pol.tablename || '_tenant_insert', pol.tablename, wc);

    execute format('create policy %I on public.%I for update using ((%s) and jwt_can_write()) with check ((%s) and jwt_can_write())',
      pol.tablename || '_tenant_update', pol.tablename, q, wc);

    execute format('create policy %I on public.%I for delete using ((%s) and jwt_can_delete())',
      pol.tablename || '_tenant_delete', pol.tablename, q);

    raise notice 'split society_rw → 4 role-scoped policies on public.%', pol.tablename;
  end loop;
end $$;
