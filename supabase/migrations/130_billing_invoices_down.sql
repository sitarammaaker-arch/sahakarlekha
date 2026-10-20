-- 130 down · drops the billing-invoice tables + issue_invoice — LOSES every issued invoice and the FY
-- counters. Run only before any real invoice is issued (an issued tax invoice must be kept).
begin;
drop function if exists public.issue_invoice(text, jsonb);
drop table if exists public.invoices;
drop table if exists public.invoice_counters;
drop table if exists public.billing_seller;
delete from public.app_migrations where version = '130';
commit;
notify pgrst, 'reload schema';
