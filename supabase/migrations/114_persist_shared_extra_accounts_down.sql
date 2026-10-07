-- 114 down · remove ONLY the accounts migration 114 added, and only where nothing references them.
-- (Rows are identified by id from ACCOUNTS_TO_ADD with an opening balance of 0 and no postings / links; an account
-- that already has a voucher leg, an opening event or a stock item is kept.)
begin;
delete from public.accounts a
 where a.id in ('4200', '4300', '3104', '3400', '4100', '4101', '4102', '5100', '5101', '2107', '2109', '3307', '2203', '2204', '5203', '5204', '5209', '2205', '3108', '3109', '3110', '3111', '3112', '3310', '3311', '5308', '5309', '5310', '5311', '5505', '1209', '1210', '1211', '2206', '2207', '2208', '2209', '2210', '2211', '2304', '2305', '3107', '3207', '3208', '3312', '3313', '3314', '3315', '3316', '3406', '4207', '4208', '4304', '4305', '4408', '4409', '4410', '5206', '5207', '5208', '5312', '5313', '5314', '5315', '5404', '5405', '5406', '5407', '5603', '5604', '5605', '4104', '4105', '4106', '4107', '4108', '5110', '5111', '5112', '5113', '5114', '5115', '5116', '5150')
   and coalesce(a."openingBalance", 0) = 0
   and not exists (select 1 from public.voucher_lines l where l.society_id::text = a.society_id::text and l.account_id = a.id)
   and not exists (select 1 from public.voucher_entries l where l.society_id::text = a.society_id::text and l."accountId" = a.id)
   and not exists (select 1 from public.stock_items s where s.society_id::text = a.society_id::text and (s."salesAccountId" = a.id or s."purchaseAccountId" = a.id))
   and not exists (select 1 from public.account_roles r where r.society_id::text = a.society_id::text and r.account_id = a.id)
   and not exists (select 1 from public.accounts c where c.society_id = a.society_id and c."parentId" = a.id);
delete from public.app_migrations where version = '114';
commit;
