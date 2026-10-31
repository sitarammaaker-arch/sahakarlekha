-- 149 down · drop the sign-in indexes. Run each statement on its own (concurrently cannot run in a transaction).
drop index concurrently if exists public.accounts_society_id_idx;
drop index concurrently if exists public.stock_movements_society_created_idx;
