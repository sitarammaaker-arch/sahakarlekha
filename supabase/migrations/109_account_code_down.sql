-- 109 undo · drops accounts.code and its unique index (assigned readable codes are LOST;
-- account ids — the keys vouchers reference — are untouched).

begin;

drop index if exists public.accounts_society_code_uniq;
alter table public.accounts drop column if exists code;

commit;

notify pgrst, 'reload schema';
