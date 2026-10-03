-- 100 down · remove the accounts migration 100 inserted — but ONLY those that are still unused.
--
-- An account row is deleted only if nothing references it any more (no voucher / voucher_entries / voucher_lines
-- leg, no supplier / customer link, no stock-item routing, no role mapping, no child account). A row that has been
-- used since 100 ran is KEPT, a NOTICE names it, and its log row stays — deleting a posted-to account would
-- orphan ledger history. Accounts that existed before 100 are never touched (they are not in the log).

begin;

do $$
declare r record; used boolean; kept int := 0; removed int := 0;
begin
  if to_regclass('public.account_seed_log') is null then
    raise notice '100 down: account_seed_log does not exist — nothing to undo';
    return;
  end if;
  for r in select id, society_id, account_id from public.account_seed_log where migration = '100' order by id desc loop
    used :=
         exists (select 1 from public.voucher_entries ve where ve.society_id::text = r.society_id and ve."accountId" = r.account_id)
      or exists (select 1 from public.voucher_lines vl where vl.society_id::text = r.society_id and vl.account_id = r.account_id)
      or exists (select 1 from public.vouchers v where v.society_id::text = r.society_id and (v."debitAccountId" = r.account_id or v."creditAccountId" = r.account_id))
      or exists (select 1 from public.suppliers s where s.society_id::text = r.society_id and s."accountId" = r.account_id)
      or exists (select 1 from public.customers c where c.society_id::text = r.society_id and c."accountId" = r.account_id)
      or exists (select 1 from public.stock_items si where si.society_id::text = r.society_id and (si."salesAccountId" = r.account_id or si."purchaseAccountId" = r.account_id))
      or exists (select 1 from public.account_roles ar where ar.society_id::text = r.society_id and ar.account_id = r.account_id)
      or exists (select 1 from public.accounts ch where ch.society_id::text = r.society_id and ch."parentId" = r.account_id)
      or exists (select 1 from public.accounts a where a.society_id::text = r.society_id and a.id = r.account_id and coalesce(a."openingBalance", 0) <> 0);
    if used then
      kept := kept + 1;
      raise notice '100 down: kept % in society % (it is referenced or has a balance)', r.account_id, r.society_id;
    else
      delete from public.accounts a where a.society_id::text = r.society_id and a.id = r.account_id;
      delete from public.account_seed_log where id = r.id;
      removed := removed + 1;
    end if;
  end loop;
  raise notice '100 down: removed %, kept %', removed, kept;
end $$;

delete from public.app_migrations where version = '100';

-- Drop the log only when nothing is left in it (kept rows still need it).
do $$
begin
  if to_regclass('public.account_seed_log') is not null
     and not exists (select 1 from public.account_seed_log) then
    drop table public.account_seed_log;
  end if;
end $$;

commit;
