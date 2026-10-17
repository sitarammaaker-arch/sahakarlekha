-- 121 down · the browser-supplied actor is stored as sent again. Rows already stamped stay as they are.
begin;
drop trigger if exists audit_log_stamp_actor on public.audit_log;
drop function if exists public.audit_log_stamp_actor();
delete from public.app_migrations where version = '121';
commit;
