-- 205 down · removes the two columns. Cheque numbers saved on vouchers since are lost; no ledger depended on them.
alter table public.vouchers drop column if exists "chequeDate";
alter table public.vouchers drop column if exists "chequeNo";

notify pgrst, 'reload schema';

delete from public.app_migrations where version = '205';
