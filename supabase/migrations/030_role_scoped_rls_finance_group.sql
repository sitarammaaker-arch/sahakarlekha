-- 030 · role-scoped mutation RLS — the clear financial data-entry group. Audit P0-3, Layer B / SB2.
--
-- Same PROVEN pattern as branches (029): INSERT/UPDATE gate on jwt_can_write() (admin+accountant),
-- DELETE on jwt_can_delete() (admin only); SELECT unchanged; backward-compatible (no user_role claim
-- ⇒ allowed, so no one on an old session is locked out). Applied ONLY to tables whose intended rule
-- is exactly "admin+accountant enter, admin deletes":
--   godowns, deposit_accounts, deposit_transactions, kachi_aarat_entries, p7_entries,
--   recoverables, compliance_filings.
--
-- Deliberately EXCLUDED (different rules — separate slices): vouchers/members/accounts/sales/purchases
-- /stock (FOR ALL policies), society_users/societies/*capabilities (admin-only config/user-mgmt),
-- feedback/leads (open), audit_log/ledger_events/document_sequences (system/WORM, tenant-only).
--
-- SAFE by construction: for each existing tenant mutation policy it APPENDS the role predicate to the
-- policy's OWN existing expression (so the exact tenant predicate + any ::text cast is preserved, not
-- guessed), skips any policy already role-scoped (idempotent), and only touches policies that
-- reference get_current_society_id(). Run once; then re-query pg_policies on one table to confirm.

do $$
declare
  pol record;
  role_fn text;
  tbls text[] := array[
    'godowns','deposit_accounts','deposit_transactions','kachi_aarat_entries',
    'p7_entries','recoverables','compliance_filings'
  ];
begin
  for pol in
    select tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename = any(tbls)
      and cmd in ('INSERT','UPDATE','DELETE')
      and coalesce(qual,'') || coalesce(with_check,'') like '%get_current_society_id()%'
      and coalesce(qual,'') || coalesce(with_check,'') not like '%jwt_can_%'   -- idempotent
  loop
    role_fn := case when pol.cmd = 'DELETE' then 'jwt_can_delete()' else 'jwt_can_write()' end;
    execute format(
      'alter policy %I on public.%I%s%s',
      pol.policyname, pol.tablename,
      case when pol.qual       is not null then format(' using ((%s) and %s)',       pol.qual,       role_fn) else '' end,
      case when pol.with_check  is not null then format(' with check ((%s) and %s)', pol.with_check, role_fn) else '' end
    );
    raise notice 'role-scoped %.% (%)', pol.tablename, pol.policyname, pol.cmd;
  end loop;
end $$;
