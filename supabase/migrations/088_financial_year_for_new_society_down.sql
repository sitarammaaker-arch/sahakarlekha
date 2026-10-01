-- 088 undo · removes the new-society FY trigger. FY rows it already created are KEPT (they are
-- correct, and voucher_lines may reference them); delete one by hand only if nothing points at it.

begin;

drop trigger if exists trg_financial_year_for_new_society on public.society_settings;
drop function if exists public.tg_financial_year_for_new_society();
delete from public.app_migrations where version = '088';

commit;
