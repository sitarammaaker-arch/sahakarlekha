-- 079 down · drop approve_voucher. Approvals already made through it stay (ordinary approved vouchers
-- with lines, entries and a voucher.posted event); only the function goes.
begin;
drop function if exists public.approve_voucher(text, jsonb, text);
delete from public.app_migrations where version = '079';
commit;
