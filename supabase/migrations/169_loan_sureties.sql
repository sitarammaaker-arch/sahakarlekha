-- 169 · loan sureties (guarantors)
--
-- Who stands surety for a member's loan is kept ON the loan as a list:
--   [{ "memberId": "<members.id>", "name": "", "phone": "", "address": "" }, …]
-- memberId is set when the surety is a member; an outside surety has a name only.
--
-- The app saves this column in a second step, after the loan row itself, so loans keep saving on a database that
-- has not run this migration yet — only the sureties are refused there, with a message.
--
-- No backfill: existing loans start with an empty list. RLS is unchanged (the column lives on loans).
begin;

alter table public.loans add column if not exists sureties jsonb default '[]'::jsonb;

comment on column public.loans.sureties is 'Sureties (guarantors) of the loan: [{memberId?, name, phone?, address?}]. Added by 169.';

commit;

-- VERIFY (run after the migration; expect one row: sureties | jsonb):
--   select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'loans' and column_name = 'sureties';
