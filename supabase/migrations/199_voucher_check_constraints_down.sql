-- Undo 199 · drops the five CHECK rules on vouchers and voucher_entries and forgets the migration row.
begin;

alter table public.vouchers drop constraint if exists vouchers_amount_nonneg;
alter table public.vouchers drop constraint if exists vouchers_type_known;
alter table public.vouchers drop constraint if exists vouchers_approval_status_known;
alter table public.vouchers drop constraint if exists vouchers_date_iso;
alter table public.voucher_entries drop constraint if exists voucher_entries_amounts;

delete from public.app_migrations where version = '199';

commit;
