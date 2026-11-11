-- 157 down · remove ONLY the accounts migration 157 added, where nothing references them.
begin;
delete from public.accounts a
 where a.id in ('1297', '1298', '2194', '2195', '2199', '5498')
   and a.name in ('Subsidy for Society (Capital Grant)', 'Capital Reserve', 'Provision for NPAs', 'Provision for Standard Assets', 'Subsidy held for Members', 'Loan Loss Provisions')
   and coalesce(a."openingBalance", 0) = 0
   and not exists (select 1 from public.voucher_lines l where l.society_id::text = a.society_id::text and l.account_id = a.id)
   and not exists (select 1 from public.voucher_entries l where l.society_id::text = a.society_id::text and l."accountId" = a.id)
   and not exists (select 1 from public.account_roles r where r.society_id::text = a.society_id::text and r.account_id = a.id);
delete from public.app_migrations where version = '157';
commit;
notify pgrst, 'reload schema';
