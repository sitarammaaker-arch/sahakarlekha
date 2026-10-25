-- 141 down · drops hired trips and the transporter ledger column. Cancel trip vouchers in the app first,
-- or they stay as orphan ledger entries. Data is lost — export first.

begin;

drop table if exists public.marketing_hired_trips;
alter table public.marketing_transporters drop column if exists "ledgerAccountId";

delete from public.app_migrations where version = '141';

commit;

notify pgrst, 'reload schema';
