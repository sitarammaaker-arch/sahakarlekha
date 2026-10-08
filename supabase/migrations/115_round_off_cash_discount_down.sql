-- 115 down · remove ONLY the accounts migration 115 added (where nothing references them) and the 3 columns.
-- Run only if no bill has used them yet: dropping the columns loses any stored round off / cash discount.
begin;
delete from public.accounts a
 where a.id in ('4499', '5499')
   and coalesce(a."openingBalance", 0) = 0
   and not exists (select 1 from public.voucher_lines l where l.society_id::text = a.society_id::text and l.account_id = a.id)
   and not exists (select 1 from public.voucher_entries l where l.society_id::text = a.society_id::text and l."accountId" = a.id)
   and not exists (select 1 from public.account_roles r where r.society_id::text = a.society_id::text and r.account_id = a.id);
alter table public.sales     drop column if exists "roundOff";
alter table public.purchases drop column if exists "cashDiscount";
alter table public.purchases drop column if exists "roundOff";
delete from public.app_migrations where version = '115';
commit;
notify pgrst, 'reload schema';
