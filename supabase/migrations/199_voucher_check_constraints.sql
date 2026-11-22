-- 199 · CHECK rules on vouchers and voucher_entries (DB-06, product audit 2026-11-17).
--
-- WHY: the database accepted any voucher type, any approval status, a negative amount, a date in any shape, and an
-- entry with both a debit and a credit. Reports compare dates as text ('2026-04-01' <= date), so one '01/04/2026'
-- silently drops a voucher out of every period report. voucher_lines already has these rules (voucher_lines_amounts);
-- the voucher row and the entries mirror did not.
--
-- WHAT IS THERE (read-only, prod 2026-11-22): 3,371 vouchers and 2,169 entries — every row already passes every rule
-- below (types: the 8 VoucherType values; approvalStatus: approved / pending / rejected / null; no negative or null
-- amount; every date 'YYYY-MM-DD'; no entry negative or with both a debit and a credit).
--
-- HOW: each constraint is added NOT VALID (no long lock) and then validated; a row that breaks a rule makes VALIDATE
-- fail and the whole migration rolls back — nothing is changed. Values mirror src/types (VoucherType, approvalStatus).
-- The column type of vouchers.date stays text (readers compare it as text); the CHECK pins its shape.
--
-- A missing type or date is refused too (0 such rows).
--
-- Down: 199_voucher_check_constraints_down.sql drops the five constraints.
begin;

alter table public.vouchers drop constraint if exists vouchers_amount_nonneg;
alter table public.vouchers add constraint vouchers_amount_nonneg
  check (amount >= 0) not valid;

alter table public.vouchers drop constraint if exists vouchers_type_known;
alter table public.vouchers add constraint vouchers_type_known
  check (type is not null and type in ('receipt', 'payment', 'journal', 'contra', 'purchase', 'sale', 'debit_note', 'credit_note')) not valid;

alter table public.vouchers drop constraint if exists vouchers_approval_status_known;
alter table public.vouchers add constraint vouchers_approval_status_known
  check ("approvalStatus" is null or "approvalStatus" in ('pending', 'approved', 'rejected')) not valid;

alter table public.vouchers drop constraint if exists vouchers_date_iso;
alter table public.vouchers add constraint vouchers_date_iso
  check (date is not null and date ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$') not valid;

alter table public.voucher_entries drop constraint if exists voucher_entries_amounts;
alter table public.voucher_entries add constraint voucher_entries_amounts
  check (dr >= 0 and cr >= 0 and not (dr > 0 and cr > 0)) not valid;

alter table public.vouchers validate constraint vouchers_amount_nonneg;
alter table public.vouchers validate constraint vouchers_type_known;
alter table public.vouchers validate constraint vouchers_approval_status_known;
alter table public.vouchers validate constraint vouchers_date_iso;
alter table public.voucher_entries validate constraint voucher_entries_amounts;

insert into public.app_migrations (version, name) values ('199', 'voucher_check_constraints')
  on conflict (version) do nothing;

commit;

-- VERIFY (expect: checks = 5 | not_validated = 0 | mig = 1):
--   select count(*) as checks, count(*) filter (where not convalidated) as not_validated,
--          (select count(*) from public.app_migrations where version = '199') as mig
--     from pg_constraint
--    where conname in ('vouchers_amount_nonneg', 'vouchers_type_known', 'vouchers_approval_status_known',
--                      'vouchers_date_iso', 'voucher_entries_amounts');
