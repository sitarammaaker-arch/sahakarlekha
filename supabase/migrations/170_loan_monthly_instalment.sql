-- 170 · monthly instalment on a loan
--
-- The principal instalment the society fixes for a member's loan (interest is charged on top). The monthly recovery
-- list uses it; where it is null the list keeps deriving equal instalments over the loan's term, so existing loans
-- behave exactly as before.
--
-- The app saves this column in a second step, after the loan row itself, so loans keep saving on a database that
-- has not run this migration yet — only the instalment is refused there, with a message.
--
-- No backfill. RLS is unchanged (the column lives on loans).
begin;

alter table public.loans add column if not exists "monthlyInstallment" numeric;

comment on column public.loans."monthlyInstallment" is 'Monthly principal instalment fixed for the loan; null = not fixed (derived). Added by 170.';

commit;

-- VERIFY (run after the migration; expect one row: monthlyInstallment | numeric):
--   select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'loans' and column_name = 'monthlyInstallment';
