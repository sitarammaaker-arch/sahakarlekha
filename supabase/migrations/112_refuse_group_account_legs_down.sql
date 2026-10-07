-- 112 down · stop refusing voucher legs on group accounts at the database (the app still refuses them).
begin;
drop trigger if exists trg_refuse_group_account_leg on public.voucher_lines;
drop function if exists public.tg_refuse_group_account_leg();
delete from public.app_migrations where version = '112';
commit;
