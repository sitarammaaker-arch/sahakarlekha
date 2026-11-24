-- 202 down · removes the column. Member tags saved on purchases since are lost; no ledger depended on them.
alter table public.purchases drop column if exists "memberId";

notify pgrst, 'reload schema';

delete from public.app_migrations where version = '202';
