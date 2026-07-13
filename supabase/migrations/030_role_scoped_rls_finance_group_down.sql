-- 030 down · strip the role predicate from the finance-group mutation policies (back to tenant-only).
-- Removes the ` AND jwt_can_write()/jwt_can_delete()` this migration appended, leaving each policy's
-- original tenant expression intact.
do $$
declare
  pol record;
  cq text; cc text;
  tbls text[] := array[
    'godowns','deposit_accounts','deposit_transactions','kachi_aarat_entries',
    'p7_entries','recoverables','compliance_filings'
  ];
begin
  for pol in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public' and tablename = any(tbls)
      and coalesce(qual,'') || coalesce(with_check,'') like '%jwt_can_%'
  loop
    cq := regexp_replace(pol.qual,       '\s+AND\s+jwt_can_(write|delete)\(\)', '', 'gi');
    cc := regexp_replace(pol.with_check, '\s+AND\s+jwt_can_(write|delete)\(\)', '', 'gi');
    execute format('alter policy %I on public.%I%s%s',
      pol.policyname, pol.tablename,
      case when cq is not null then format(' using (%s)', cq) else '' end,
      case when cc is not null then format(' with check (%s)', cc) else '' end);
  end loop;
end $$;
