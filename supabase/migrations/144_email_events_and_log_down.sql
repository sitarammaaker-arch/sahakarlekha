-- 144 down · remove delivery events + the email log RPCs. Undoes 144_email_events_and_log.sql.
begin;
drop function if exists public.admin_unsuppress_email(text);
drop function if exists public.admin_email_suppression();
drop function if exists public.admin_email_log(integer);
drop function if exists public.society_email_log(integer);
drop function if exists public.record_email_event(text, text, text[], text);
drop index if exists public.idx_outbox_provider;
alter table public.notification_outbox drop column if exists delivery_event_at;
alter table public.notification_outbox drop column if exists delivery_status;
delete from public.app_migrations where version = '144';
commit;
notify pgrst, 'reload schema';
