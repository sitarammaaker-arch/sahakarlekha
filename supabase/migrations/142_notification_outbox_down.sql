-- 142 down · remove the notification outbox. Undoes 142_notification_outbox.sql (drops queued/sent history).
begin;
drop function if exists public.my_email_verification();
drop function if exists public.confirm_email_verification(text);
drop function if exists public.request_email_verification(text);
drop function if exists public.complete_outbox(uuid, boolean, text, text, boolean);
drop function if exists public.claim_outbox(integer, integer);
drop function if exists public.enqueue_notification(text, text, text, jsonb, text, text, timestamptz);
drop table if exists public.email_verifications;
drop table if exists public.email_suppression;
drop table if exists public.notification_outbox;
delete from public.app_migrations where version = '142';
commit;
notify pgrst, 'reload schema';
