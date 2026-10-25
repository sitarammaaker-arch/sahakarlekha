-- 140 down · drops the dealer-licence and scheme-claim tables. Cancel scheme-claim vouchers in the app
-- first, or they stay as orphan ledger entries. Data is lost — export first.

begin;

drop table if exists public.marketing_scheme_claims;
drop table if exists public.marketing_dealer_licences;

delete from public.app_migrations where version = '140';

commit;

notify pgrst, 'reload schema';
