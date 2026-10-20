-- 131 down · drops the platform-admin invoice RPCs and the orders "invoice pending" reason columns.
begin;
drop function if exists public.admin_list_pending_invoices();
drop function if exists public.admin_list_invoices(date, date);
alter table public.orders drop column if exists invoice_tried_at;
alter table public.orders drop column if exists invoice_error;
delete from public.app_migrations where version = '131';
commit;
notify pgrst, 'reload schema';
