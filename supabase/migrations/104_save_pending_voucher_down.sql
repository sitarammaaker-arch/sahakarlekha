-- 104 undo · drops save_pending_voucher (the app falls back to its direct pending writes, still permitted
-- until S4-b). Pending vouchers it saved are ordinary rows and stay.

begin;

drop function if exists public.save_pending_voucher(jsonb, jsonb);
delete from public.app_migrations where version = '104';

commit;
