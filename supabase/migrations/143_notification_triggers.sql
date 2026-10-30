-- 143 · Security / account notifications enqueued by triggers (2026-10-30, email slice 2).
--
-- WHY triggers: user and settings writes arrive by three routes (app_add_society_user RPC, UserManagement's
--   direct society_users update, SocietySetup's whole-object society_settings upsert). A trigger sees all of
--   them, runs in the same transaction (a rolled-back write queues nothing), and takes every recipient from
--   the database — the client never names one. A trigger only INSERTS into the outbox; send-worker sends.
--   Every enqueue is wrapped so a notification problem can never fail the user's own save.
--
-- WHAT (templates live in supabase/functions/_shared/email-outbox.mjs):
--   • user_invite          society_users INSERT → the new user. Doubles as the verification email: it carries
--                          a fresh 48 h token unless the address is already verified, so like email_verify it
--                          is allowed to an unverified address (claim_outbox exemption below).
--   • role_changed         society_users role changes → the affected user (verified addresses only).
--   • fy_unlock_requested  society_settings."fyUnlockRequestedBy" set → every OTHER active admin (ECR-07 dual
--                          control: a different admin must approve).
--   • fy_unlocked          society_settings."fyLocked" true → false → every active admin.
--   Actor = the JWT email of whoever made the change (null for a server/SQL change → "system").
--
-- society_users is backupPolicy 'exclude', so a restore never re-inserts users (no invite storm).
-- Additive. Undo: 143_notification_triggers_down.sql (restores the 142 claim_outbox).

begin;

-- ── claim_outbox: user_invite joins email_verify as allowed-before-verification ──
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
  update public.notification_outbox
     set status = 'failed', locked_until = null, last_error = coalesce(last_error, 'lease expired') || ' · gave up after 5 attempts'
   where status = 'sending' and locked_until < now() and attempts >= 5;

  update public.notification_outbox o
     set status = 'suppressed', last_error = 'suppressed: ' || s.reason
    from public.email_suppression s
   where o.status = 'pending' and o.channel = 'email' and o.recipient = s.email;

  -- Never send to an unproved address — except the two emails that carry the proof link.
  update public.notification_outbox o
     set status = 'skipped', last_error = 'unverified recipient'
   where o.status = 'pending' and o.channel = 'email' and o.template_key not in ('email_verify', 'user_invite')
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

-- ── helpers ───────────────────────────────────────────────────────────────────
-- The society's display name (society_settings.name, else societies.name, else the id).
create or replace function public.notify_society_name(p_society_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select nullif(trim(ss.name), '') from public.society_settings ss where ss.society_id = p_society_id limit 1),
    (select nullif(trim(s.name), '') from public.societies s where s.id::text = p_society_id limit 1),
    p_society_id);
$$;
revoke execute on function public.notify_society_name(text) from public, anon, authenticated;

-- ── society_users: invite + role change ───────────────────────────────────────
create or replace function public.tg_notify_society_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email   text := lower(trim(coalesce(new.email, '')));
  v_actor   text := nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '');
  v_society text := new.society_id::text;
  v_token   text;
begin
  if v_email = '' or not coalesce(new.is_active, true) then return new; end if;
  begin
    if tg_op = 'INSERT' then
      if not exists (select 1 from public.email_verifications where email = v_email and verified_at is not null) then
        v_token := encode(gen_random_bytes(24), 'hex');
        insert into public.email_verifications as v (email, token_hash, token_expires_at, requested_at)
        values (v_email, encode(digest(v_token, 'sha256'), 'hex'), now() + interval '48 hours', now())
        on conflict (email) do update
          set token_hash = excluded.token_hash, token_expires_at = excluded.token_expires_at,
              requested_at = excluded.requested_at;
      end if;
      perform public.enqueue_notification(
        v_society, 'user_invite', v_email,
        jsonb_strip_nulls(jsonb_build_object('token', v_token, 'name', new.name, 'role', new.role,
          'society_name', public.notify_society_name(v_society), 'by', coalesce(v_actor, 'system'))),
        'user_invite:' || new.id::text);
    elsif new.role is distinct from old.role then
      perform public.enqueue_notification(
        v_society, 'role_changed', v_email,
        jsonb_build_object('name', new.name, 'old_role', old.role, 'new_role', new.role,
          'society_name', public.notify_society_name(v_society), 'by', coalesce(v_actor, 'system')),
        'role_changed:' || new.id::text || ':' || coalesce(new.role, '') || ':' || extract(epoch from clock_timestamp())::bigint);
    end if;
  exception when others then
    raise warning 'tg_notify_society_user: notification not queued (%)', sqlerrm;
  end;
  return new;
end;
$$;
revoke execute on function public.tg_notify_society_user() from public, anon, authenticated;

drop trigger if exists trg_notify_society_user_ins on public.society_users;
create trigger trg_notify_society_user_ins
  after insert on public.society_users
  for each row execute function public.tg_notify_society_user();

drop trigger if exists trg_notify_society_user_role on public.society_users;
create trigger trg_notify_society_user_role
  after update of role on public.society_users
  for each row when (old.role is distinct from new.role)
  execute function public.tg_notify_society_user();

-- ── society_settings: FY unlock requested / FY unlocked ───────────────────────
create or replace function public.tg_notify_fy_unlock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor   text := nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '');
  v_society text := new.society_id::text;
  v_name    text;
  v_admin   record;
  v_stamp   text := extract(epoch from clock_timestamp())::bigint::text;
  v_tpl     text;
begin
  if coalesce(old."fyLocked", false) and not coalesce(new."fyLocked", false) then
    v_tpl := 'fy_unlocked';
  elsif coalesce(new."fyLocked", false) and new."fyUnlockRequestedBy" is not null
        and new."fyUnlockRequestedBy" is distinct from old."fyUnlockRequestedBy" then
    v_tpl := 'fy_unlock_requested';
  else
    return new;
  end if;
  begin
    v_name := public.notify_society_name(v_society);
    for v_admin in
      select distinct lower(su.email) as email, su.name
        from public.society_users su
       where su.society_id::text = v_society and su.role = 'admin' and su.is_active
         and coalesce(su.email, '') <> ''
         -- the requester does not need to be told about their own request
         and (v_tpl <> 'fy_unlock_requested' or lower(su.email) <> lower(new."fyUnlockRequestedBy"))
    loop
      perform public.enqueue_notification(
        v_society, v_tpl, v_admin.email,
        jsonb_build_object('name', v_admin.name, 'society_name', v_name,
          'by', coalesce(case when v_tpl = 'fy_unlock_requested' then lower(new."fyUnlockRequestedBy") end, v_actor, 'system'),
          'financial_year', new."financialYear"),
        v_tpl || ':' || v_society || ':' || v_admin.email || ':' || v_stamp);
    end loop;
  exception when others then
    raise warning 'tg_notify_fy_unlock: notification not queued (%)', sqlerrm;
  end;
  return new;
end;
$$;
revoke execute on function public.tg_notify_fy_unlock() from public, anon, authenticated;

drop trigger if exists trg_notify_fy_unlock on public.society_settings;
create trigger trg_notify_fy_unlock
  after update on public.society_settings
  for each row execute function public.tg_notify_fy_unlock();

insert into public.app_migrations (version, name) values ('143', 'notification_triggers')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: triggers = 3 | fns = 3 | mig = 1):
--   select (select count(*) from pg_trigger where tgname in ('trg_notify_society_user_ins', 'trg_notify_society_user_role',
--             'trg_notify_fy_unlock')) as triggers,
--          (select count(*) from pg_proc where proname in ('tg_notify_society_user', 'tg_notify_fy_unlock',
--             'notify_society_name')) as fns,
--          (select count(*) from public.app_migrations where version = '143') as mig;
