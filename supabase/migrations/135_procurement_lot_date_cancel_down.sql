-- 135 down · drops the lot business date and cancellation columns. A cancelled lot then shows as live
-- again (its reversal vouchers stay in the ledger) — run only before any lot has been cancelled.

begin;

alter table public.procurement_lots drop column if exists "cancelReason";
alter table public.procurement_lots drop column if exists "cancelledBy";
alter table public.procurement_lots drop column if exists "cancelledAt";
alter table public.procurement_lots drop column if exists "lotDate";

delete from public.app_migrations where version = '135';

commit;

notify pgrst, 'reload schema';
