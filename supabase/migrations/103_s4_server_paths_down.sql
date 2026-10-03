-- 103 undo · drops the five S4-a server functions (the app falls back to its direct writes, which are
-- still permitted until S4-b). Nothing written by them is undone — those rows are ordinary data.

begin;

drop function if exists public.reject_voucher(text, text, text);
drop function if exists public.set_voucher_cleared(text, boolean, text);
drop function if exists public.link_voucher_reversal(text, text);
drop function if exists public.sync_account_opening_event(text, bigint);
drop function if exists public.merge_accounts(text, text, text);
delete from public.app_migrations where version = '103';

commit;
