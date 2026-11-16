-- 170 down · remove the loan's monthly instalment. DESTRUCTIVE: every instalment entered on a loan is lost
-- (the recovery list goes back to deriving equal instalments for all loans).
begin;

alter table public.loans drop column if exists "monthlyInstallment";

commit;
