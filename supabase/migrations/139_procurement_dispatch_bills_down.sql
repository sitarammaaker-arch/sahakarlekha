-- 139 down · drops the dispatch and agency-bill tables. Their vouchers stay in the ledger (cancel them
-- through the app BEFORE running this, or they become orphan entries). Data is lost — export first.

begin;

drop table if exists public.procurement_agency_bills;
drop table if exists public.procurement_dispatches;

delete from public.app_migrations where version = '139';

commit;

notify pgrst, 'reload schema';
