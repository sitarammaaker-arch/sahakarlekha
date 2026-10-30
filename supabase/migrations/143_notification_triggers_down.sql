-- 143 down · remove the notification triggers and restore migration 142's claim_outbox. Undoes 143.
begin;
drop trigger if exists trg_notify_fy_unlock on public.society_settings;
drop trigger if exists trg_notify_society_user_role on public.society_users;
drop trigger if exists trg_notify_society_user_ins on public.society_users;
drop function if exists public.tg_notify_fy_unlock();
drop function if exists public.tg_notify_society_user();
drop function if exists public.notify_society_name(text);

-- claim_outbox exactly as 142 shipped it (only email_verify allowed before verification).
create or replace function public.claim_outbox(p_limit integer default 20, p_daily_cap integer default 90)
returns setof public.notification_outbox
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  v_room      integer;
begin
  -- A reclaimed lease that has already used its 5 attempts is not tried a 6th time.
  update public.notification_outbox
     set status = 'failed', locked_until = null, last_error = coalesce(last_error, 'lease expired') || ' · gave up after 5 attempts'
   where status = 'sending' and locked_until < now() and attempts >= 5;

  -- Never send to a suppressed address.
  update public.notification_outbox o
     set status = 'suppressed', last_error = 'suppressed: ' || s.reason
    from public.email_suppression s
   where o.status = 'pending' and o.channel = 'email' and o.recipient = s.email;

  -- Never send to an unproved address — except the verification email that proves it.
  update public.notification_outbox o
     set status = 'skipped', last_error = 'unverified recipient'
   where o.status = 'pending' and o.channel = 'email' and o.template_key <> 'email_verify'
     and not exists (select 1 from public.email_verifications v
                      where v.email = o.recipient and v.verified_at is not null);

  select greatest(0, coalesce(p_daily_cap, 90) - count(*))::integer into v_room
    from public.notification_outbox
   where channel = 'email' and sent_at >= v_day_start;
  v_room := least(v_room, greatest(0, coalesce(p_limit, 20)));
  if v_room = 0 then return; end if;

  return query
  update public.notification_outbox o
     set status = 'sending', attempts = o.attempts + 1, locked_until = now() + interval '5 minutes'
   where o.id in (
     select id from public.notification_outbox
      where channel = 'email'
        and ((status = 'pending' and scheduled_at <= now())
          or (status = 'sending' and locked_until < now()))
      order by scheduled_at
      limit v_room
      for update skip locked)
  returning o.*;
end;
$$;
revoke execute on function public.claim_outbox(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_outbox(integer, integer) to service_role;

delete from public.app_migrations where version = '143';
commit;
notify pgrst, 'reload schema';
