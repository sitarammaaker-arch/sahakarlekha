-- 089 undo · new societies no longer get the flag automatically. Flags already set are KEPT (switch a
-- society back by hand with society_flags if ever needed).

begin;

drop trigger if exists trg_posting_service_for_new_society on public.society_settings;
drop function if exists public.tg_posting_service_for_new_society();
delete from public.app_migrations where version = '089';

commit;
