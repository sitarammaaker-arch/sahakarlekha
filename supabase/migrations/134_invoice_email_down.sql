-- 134 down · remove the invoice-email columns. Undoes 134_invoice_email.sql.
begin;
alter table public.invoices drop column if exists email_error;
alter table public.invoices drop column if exists emailed_to;
alter table public.invoices drop column if exists emailed_at;
alter table public.orders drop column if exists payer_email;
delete from public.app_migrations where version = '134';
commit;
notify pgrst, 'reload schema';
