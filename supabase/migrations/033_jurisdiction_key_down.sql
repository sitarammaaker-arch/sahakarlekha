-- 033 down · remove the jurisdiction key (indexes + columns).
--
-- NOTE — T-01's own rollback guidance (blueprint) is NOT this: because the columns are
-- additive/nullable and harmless, the recommended rollback is to LEAVE them in place and disable the
-- write-path stamping via the code flag instead. Use this teardown only for a genuine full reversal;
-- dropping the columns discards any backfilled jurisdiction values.

drop index if exists vouchers_jurisdiction_idx;
drop index if exists voucher_entries_jurisdiction_idx;
drop index if exists members_jurisdiction_idx;

do $$
declare r record;
begin
  for r in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'jurisdiction'
  loop
    execute format('alter table public.%I drop column if exists jurisdiction', r.table_name);
  end loop;
end $$;
