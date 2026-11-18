-- Undo 178: remove the server restore (Restore Center then cannot commit — it no longer writes from the browser).
begin;
drop function if exists public.restore_commit(uuid, int, text, text, jsonb);
drop function if exists public.restore_stage(uuid, int, jsonb);
drop function if exists public._restore_voucher_legs(public.vouchers);
drop function if exists public._restore_leg_key(jsonb);
drop table if exists public.restore_staging;
drop table if exists public.restore_tables;
delete from public.app_migrations where version = '178';
commit;
