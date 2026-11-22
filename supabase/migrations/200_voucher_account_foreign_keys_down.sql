-- Undo 200 · drops the three account foreign keys and their indexes, and forgets the migration row.
begin;

alter table public.vouchers drop constraint if exists vouchers_debit_account_fkey;
alter table public.vouchers drop constraint if exists vouchers_credit_account_fkey;
alter table public.voucher_entries drop constraint if exists voucher_entries_account_fkey;

drop index if exists public.idx_vouchers_debit_account;
drop index if exists public.idx_vouchers_credit_account;
drop index if exists public.idx_ve_account_society;

delete from public.app_migrations where version = '200';

commit;
