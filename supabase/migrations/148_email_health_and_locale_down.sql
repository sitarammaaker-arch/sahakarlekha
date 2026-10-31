-- 148 down · remove the email health check and the language preference; restore 142's enqueue_notification
-- and 147's my_email_preferences. Undoes 148_email_health_and_locale.sql.
begin;
drop function if exists public.admin_email_health();
drop function if exists public.claim_email_health_alert();
drop function if exists public.email_health();
drop table if exists public.email_health_alerts;
drop function if exists public.set_my_email_locale(text);

-- enqueue_notification exactly as 142 shipped it.
create or replace function public.enqueue_notification(
  p_society_id      text,
  p_template_key    text,
  p_recipient       text,
  p_payload         jsonb,
  p_idempotency_key text,
  p_locale          text default 'hi',
  p_scheduled_at    timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.notification_outbox
    (society_id, template_key, locale, recipient, payload, idempotency_key, scheduled_at)
  values
    (p_society_id, p_template_key, coalesce(p_locale, 'hi'), lower(trim(p_recipient)),
     coalesce(p_payload, '{}'::jsonb), p_idempotency_key, coalesce(p_scheduled_at, now()))
  on conflict (idempotency_key) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.notification_outbox where idempotency_key = p_idempotency_key;
  end if;
  return v_id;
end;
$$;
revoke execute on function public.enqueue_notification(text, text, text, jsonb, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.enqueue_notification(text, text, text, jsonb, text, text, timestamptz) to service_role;

-- my_email_preferences exactly as 147 shipped it.
create or replace function public.my_email_preferences()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('email', e.email, 'weekly_digest', coalesce(p.weekly_digest, true))
  from (select lower(trim(coalesce(auth.jwt() ->> 'email', ''))) as email) e
  left join public.email_preferences p on p.email = e.email
  where e.email <> '';
$$;
revoke execute on function public.my_email_preferences() from public, anon;
grant execute on function public.my_email_preferences() to authenticated;

alter table public.email_preferences drop column if exists locale;
delete from public.app_migrations where version = '148';
commit;
notify pgrst, 'reload schema';
