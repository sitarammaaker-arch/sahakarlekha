-- 206 down · drops set_voucher_cheque. A posting-service society can then no longer save a cheque no. (the app shows its
-- mild "voucher saved, cheque no. not" warning); stored cheque numbers stay.
drop function if exists public.set_voucher_cheque(text, text, text);

notify pgrst, 'reload schema';

delete from public.app_migrations where version = '206';
