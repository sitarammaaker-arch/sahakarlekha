-- 200 · foreign keys: a voucher and its entries can only name an account of the SAME society (DB-03, audit 2026-11-17).
--
-- WHY: nothing tied vouchers.debitAccountId / creditAccountId or voucher_entries.accountId to accounts. A voucher could
-- name an account that does not exist, or another society's account, and every report would carry a "[Deleted]" row.
-- voucher_lines and account_roles already have exactly this key (account_id, society_id) → accounts(id, society_id);
-- the voucher row and the entries mirror did not.
--
-- WHAT IS THERE (read-only, prod 2026-11-22): 3,371 vouchers, 2,169 entries — 0 debit, 0 credit, 0 entry references
-- to a missing or other-society account; no blank account id. Entries and lines all sit in their voucher's society.
--
-- WHY NO NEW FAILURE: a posted voucher is written by post_voucher, which writes voucher_lines with this same key in the
-- same transaction, and an account that has voucher_lines can already not be deleted. A PENDING voucher
-- (save_pending_voucher, no lines yet) is now checked too — it could only fail by naming an account that is not there. merge_accounts (153)
-- re-points vouchers and entries before it deletes the merged account. Restore inserts accounts before vouchers.
--
-- NOT HERE (and why):
--   • vouchers.memberId / loans.memberId → members: 6 vouchers carry memberId '' (the app sends an empty string), 35
--     cancelled practice-society receipts point at members that were hard-deleted long ago, and a Replace restore
--     deletes members. A member key first needs '' → null at the save path and a restore keep-rule. Follow-up.
--   • society_id → societies: societies.id is uuid, every society_id column is text — a key needs the type change
--     first (DB-04 remainder).
--
-- HOW: each key NOT VALID, then VALIDATE (a missing account makes the whole migration roll back — nothing changes).
-- Indexes on the referencing columns so an account delete does not scan every voucher.
-- Down: 200_voucher_account_foreign_keys_down.sql.
begin;

create index if not exists idx_vouchers_debit_account  on public.vouchers ("debitAccountId", society_id);
create index if not exists idx_vouchers_credit_account on public.vouchers ("creditAccountId", society_id);
create index if not exists idx_ve_account_society      on public.voucher_entries ("accountId", society_id);

alter table public.vouchers drop constraint if exists vouchers_debit_account_fkey;
alter table public.vouchers add constraint vouchers_debit_account_fkey
  foreign key ("debitAccountId", society_id) references public.accounts (id, society_id) not valid;

alter table public.vouchers drop constraint if exists vouchers_credit_account_fkey;
alter table public.vouchers add constraint vouchers_credit_account_fkey
  foreign key ("creditAccountId", society_id) references public.accounts (id, society_id) not valid;

alter table public.voucher_entries drop constraint if exists voucher_entries_account_fkey;
alter table public.voucher_entries add constraint voucher_entries_account_fkey
  foreign key ("accountId", society_id) references public.accounts (id, society_id) not valid;

alter table public.vouchers validate constraint vouchers_debit_account_fkey;
alter table public.vouchers validate constraint vouchers_credit_account_fkey;
alter table public.voucher_entries validate constraint voucher_entries_account_fkey;

insert into public.app_migrations (version, name) values ('200', 'voucher_account_foreign_keys')
  on conflict (version) do nothing;

commit;

-- VERIFY (expect: fks = 3 | not_validated = 0 | idx = 3 | mig = 1):
--   select count(*) as fks, count(*) filter (where not convalidated) as not_validated,
--          (select count(*) from pg_indexes where schemaname = 'public'
--             and indexname in ('idx_vouchers_debit_account', 'idx_vouchers_credit_account', 'idx_ve_account_society')) as idx,
--          (select count(*) from public.app_migrations where version = '200') as mig
--     from pg_constraint
--    where conname in ('vouchers_debit_account_fkey', 'vouchers_credit_account_fkey', 'voucher_entries_account_fkey');
