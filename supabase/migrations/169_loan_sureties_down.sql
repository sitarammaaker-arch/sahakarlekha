-- 169 down · remove loan sureties. DESTRUCTIVE: every surety recorded on a loan is lost.
begin;

alter table public.loans drop column if exists sureties;

commit;
