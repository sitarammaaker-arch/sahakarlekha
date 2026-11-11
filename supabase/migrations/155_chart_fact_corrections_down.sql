-- 155 down · restore every row migration 155 reclassified or removed (from account_reclass_log) and remove
-- the two heads it added, where nothing references them. The app's own ACCOUNT_PATCHES still shows 5311 as an
-- appropriation on screen — revert the code as well if that is the intent.
begin;
update public.accounts a
   set type = l.old_row->>'type', "parentId" = l.old_row->>'parentId', subtype = l.old_row->>'subtype',
       "openingBalanceType" = l.old_row->>'openingBalanceType', name = l.old_row->>'name', "nameHi" = l.old_row->>'nameHi'
  from public.account_reclass_log l
 where l.migration = '155' and a.society_id::text = l.society_id and a.id = l.account_id;
insert into public.accounts
select (jsonb_populate_record(null::public.accounts, l.old_row)).*
  from public.account_reclass_log l
 where l.migration = '155'
   and not exists (select 1 from public.accounts a where a.society_id::text = l.society_id and a.id = l.account_id);
delete from public.accounts a
 where a.id in ('2295', '5299')
   and a.name in ('Labour Welfare Fund Payable', 'Labour Welfare Fund Contribution')
   and coalesce(a."openingBalance", 0) = 0
   and not exists (select 1 from public.voucher_lines l where l.society_id::text = a.society_id::text and l.account_id = a.id)
   and not exists (select 1 from public.voucher_entries l where l.society_id::text = a.society_id::text and l."accountId" = a.id)
   and not exists (select 1 from public.account_roles r where r.society_id::text = a.society_id::text and r.account_id = a.id);
delete from public.account_reclass_log where migration = '155';
delete from public.app_migrations where version = '155';
commit;
notify pgrst, 'reload schema';
