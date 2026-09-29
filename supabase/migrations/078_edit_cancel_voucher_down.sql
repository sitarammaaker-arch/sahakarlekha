-- 078 down · drop edit_voucher / cancel_voucher. Edits and cancels already made through them stay
-- (ordinary rows, lines, entries and journal events); only the functions go.
begin;
drop function if exists public.edit_voucher(jsonb, jsonb, text);
drop function if exists public.cancel_voucher(text, text, text);
drop function if exists public._voucher_flip_legs(jsonb);
delete from public.app_migrations where version = '078';
commit;
