-- 136 down · drops the agency ledger / commission basis / 5116-route columns. Lots already posted keep
-- their frozen accounts (engine vouchers are immutable); only new postings fall back to 3308 / 4206.

begin;

alter table public.society_settings drop column if exists "procurementVia5116";
alter table public.procurement_agencies drop column if exists "commissionIncomeAccountId";
alter table public.procurement_agencies drop column if exists "commissionBasis";
alter table public.procurement_agencies drop column if exists "ledgerAccountId";

delete from public.app_migrations where version = '136';

commit;

notify pgrst, 'reload schema';
