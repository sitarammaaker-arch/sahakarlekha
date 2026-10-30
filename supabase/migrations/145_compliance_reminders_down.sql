-- Undo 145 · compliance reminder emails. Queued compliance_due rows stay in the outbox (send-worker still sends
-- them); delete them first if they must not go out:
--   delete from public.notification_outbox where template_key = 'compliance_due' and status = 'pending';
begin;
drop function if exists public.enqueue_compliance_due(text, date, jsonb, integer);
drop function if exists public.compliance_reminder_targets();
delete from public.app_migrations where version = '145';
commit;
notify pgrst, 'reload schema';
