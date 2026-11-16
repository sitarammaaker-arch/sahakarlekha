-- 171 down · remove the switch. Every society goes back to "no withdrawal from a compulsory deposit".
-- Withdrawals already posted stay in the books.
begin;

alter table public.society_settings drop column if exists "compulsoryDepositWithdrawal";

commit;
