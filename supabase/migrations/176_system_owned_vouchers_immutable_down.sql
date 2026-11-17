-- Undo 176: year-close and payroll-run vouchers are no longer protected by the database.
begin;
drop trigger if exists refuse_system_voucher_change on public.vouchers;
drop function if exists public._refuse_system_voucher_change();
drop function if exists public._is_system_owned_voucher(text, text);
delete from public.app_migrations where version = '176';
commit;
