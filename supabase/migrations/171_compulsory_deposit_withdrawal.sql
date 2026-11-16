-- 171 · per-society switch: withdrawal from a compulsory (thrift) deposit
--
-- Whether a member may withdraw from a compulsory deposit account while it is open is a bye-law matter, so it is a
-- setting of the society. Default false: no withdrawal, the balance is paid back when the account is closed —
-- exactly how every society behaves today, so nothing changes until an admin turns it on.
--
-- The settings save trims a column the database does not have and tells the user, so settings keep saving on a
-- database that has not run this migration yet; only this switch does not stick there.
begin;

alter table public.society_settings add column if not exists "compulsoryDepositWithdrawal" boolean default false;

comment on column public.society_settings."compulsoryDepositWithdrawal" is 'true = members may withdraw from a compulsory (thrift) deposit while the account is open. Added by 171.';

commit;

-- VERIFY (run after the migration; expect one row: compulsoryDepositWithdrawal | boolean):
--   select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'society_settings' and column_name = 'compulsoryDepositWithdrawal';
