-- Undo 146 · weekly digest email. Queued weekly_digest rows stay in the outbox (send-worker still sends them);
-- delete them first if they must not go out:
--   delete from public.notification_outbox where template_key = 'weekly_digest' and status = 'pending';
begin;
drop function if exists public.enqueue_weekly_digest(text, date, integer);
drop function if exists public.weekly_digest_targets(date);
drop function if exists public.weekly_digest_counts(text, date);
delete from public.app_migrations where version = '146';
commit;
notify pgrst, 'reload schema';
