-- Undo 193 · gives `authenticated` EXECUTE on plan_allows() back (the 161 grant).
begin;
grant execute on function public.plan_allows(text, text) to authenticated;
delete from public.app_migrations where version = '193';
commit;
