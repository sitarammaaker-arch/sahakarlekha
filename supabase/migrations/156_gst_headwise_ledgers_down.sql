-- 156 down · remove ONLY the accounts migration 156 added, where nothing references them.
begin;
delete from public.accounts a
 where a.id in ('2291', '2292', '2293', '3391', '3392', '3393')
   and a.name in ('Output CGST', 'Output SGST', 'Output IGST', 'Input CGST', 'Input SGST', 'Input IGST')
   and coalesce(a."openingBalance", 0) = 0
   and not exists (select 1 from public.voucher_lines l where l.society_id::text = a.society_id::text and l.account_id = a.id)
   and not exists (select 1 from public.voucher_entries l where l.society_id::text = a.society_id::text and l."accountId" = a.id)
   and not exists (select 1 from public.account_roles r where r.society_id::text = a.society_id::text and r.account_id = a.id);
delete from public.app_migrations where version = '156';
commit;
notify pgrst, 'reload schema';
