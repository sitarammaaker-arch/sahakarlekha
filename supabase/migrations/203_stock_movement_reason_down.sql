-- 203 down · removes the two columns. Reasons saved on stock movements since are lost; the shortage vouchers and
-- ledgers stay, because the money never depended on these columns.
alter table public.stock_movements drop column if exists "responsiblePerson";
alter table public.stock_movements drop column if exists "reason";

notify pgrst, 'reload schema';

delete from public.app_migrations where version = '203';
