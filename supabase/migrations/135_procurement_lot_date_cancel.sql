-- 135 · Procurement lot business date + lot cancellation (2026-10-25, Marketing audit batch B).
--
-- WHAT:
--   • procurement_lots."lotDate"      — the day the produce was bought (back-dating within the FY). The
--     J-Form, the posting (engine) voucher and its deductions are dated with it. Lots are created by the
--     frozen procurement_commit_transaction RPC (explicit column list, unchanged); the app writes lotDate
--     in a step-2 update right after the RPC, so lot entry works before this migration runs (it then
--     falls back to the J-Form / entry day).
--   • procurement_lots."cancelledAt" / "cancelledBy" / "cancelReason" — a cancelled lot. The app writes
--     these FIRST when cancelling; until this migration runs the cancel is refused (nothing is reversed).
--     The cascade (engine-voucher reversal, settlement + deduction voucher, commission accrual) is done by
--     the app through the existing voucher paths.
-- No RLS change: procurement_lots keeps its existing society policy (UPDATE already allowed).
-- Additive. Undo: 135_procurement_lot_date_cancel_down.sql.

begin;

alter table public.procurement_lots add column if not exists "lotDate" date;
alter table public.procurement_lots add column if not exists "cancelledAt" timestamptz;
alter table public.procurement_lots add column if not exists "cancelledBy" text;
alter table public.procurement_lots add column if not exists "cancelReason" text;

insert into public.app_migrations (version, name) values ('135', 'procurement_lot_date_cancel')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
