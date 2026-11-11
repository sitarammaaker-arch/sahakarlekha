-- 154 down · remove ONLY the accounts migration 154 added, where nothing references them.
begin;
delete from public.accounts a
 where a.id in ('2196', '2197', '2198', '2296', '2297')
   and a.name in ('Education Fund Payable', 'Provision for Gratuity', 'Outstanding Employee Bonus', 'Market Fee Payable', 'Reverse Charge GST Payable (RCM)')
   and coalesce(a."openingBalance", 0) = 0
   and not exists (select 1 from public.voucher_lines l where l.society_id::text = a.society_id::text and l.account_id = a.id)
   and not exists (select 1 from public.voucher_entries l where l.society_id::text = a.society_id::text and l."accountId" = a.id)
   and not exists (select 1 from public.account_roles r where r.society_id::text = a.society_id::text and r.account_id = a.id);
delete from public.app_migrations where version = '154';
commit;
notify pgrst, 'reload schema';
