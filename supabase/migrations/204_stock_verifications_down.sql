-- 204 down · drops the verification table. Saved counts and certificates are lost; the stock adjustments and
-- vouchers they made stay (they live in stock_movements / vouchers).
delete from public.restore_tables where table_name = 'stock_verifications';
drop table if exists public.stock_verifications;

notify pgrst, 'reload schema';

delete from public.app_migrations where version = '204';
