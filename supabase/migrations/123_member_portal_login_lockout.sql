-- 123 · Member-portal login: a per-account attempt limit, and ending a member's sessions on PIN reset
--       (member-area re-audit 2026-10-17, stage B — H-6).
--
-- WHY: the portal PIN is 6 digits and the login email used to be sha256(society|member no) — computable by anyone
-- who knows the society id (it is in the public /member/:societyId URL) and a member number (sequential). The only
-- brake was Supabase Auth's per-IP limit. A reset PIN also left the member's existing refresh token working.
--
-- WHAT (used ONLY by the Edge Functions, through the service role — no browser role can touch any of it):
--   (1) member_portal_login_attempts — one row per login key (a hash of the login email, never the email or PIN);
--   (2) member_portal_login_begin(key) — atomically TAKES one attempt slot BEFORE the password is tried: at most 5 per
--       15 minutes, then the key is locked for 15 minutes. Taking the slot first means parallel guesses cannot all slip
--       through between "check" and "record";
--   (3) member_portal_login_success(key) — clears the key after a correct PIN;
--   (4) member_portal_end_sessions(user) — deletes the member's auth sessions (refresh tokens cascade), used by
--       reset_pin / revoke so an old device cannot keep refreshing.
-- The login email also changes to a keyed HMAC (secret MEMBER_LOGIN_PEPPER in the Edge Functions) — see
-- supabase/functions/member-portal-login. Undo: 123_member_portal_login_lockout_down.sql.

begin;

create table if not exists public.member_portal_login_attempts (
  key           text primary key,
  attempts      integer not null default 0,
  window_start  timestamptz not null default now(),
  locked_until  timestamptz
);
alter table public.member_portal_login_attempts enable row level security;
revoke all on public.member_portal_login_attempts from anon, authenticated;

create or replace function public.member_portal_login_begin(p_key text) returns jsonb
  language plpgsql security definer set search_path to ''
as $$
declare
  c_max    constant integer  := 5;
  c_window constant interval := interval '15 minutes';
  c_lock   constant interval := interval '15 minutes';
  r public.member_portal_login_attempts%rowtype;
begin
  if coalesce(p_key, '') = '' then return jsonb_build_object('allowed', false); end if;
  -- housekeeping: forget keys idle for a day
  delete from public.member_portal_login_attempts where window_start < now() - interval '1 day' and (locked_until is null or locked_until < now());
  insert into public.member_portal_login_attempts (key) values (p_key) on conflict (key) do nothing;
  select * into r from public.member_portal_login_attempts where key = p_key for update;
  if r.locked_until is not null and r.locked_until > now() then
    return jsonb_build_object('allowed', false, 'locked_until', r.locked_until);
  end if;
  if r.window_start < now() - c_window or r.locked_until is not null then
    r.attempts := 0; r.window_start := now(); r.locked_until := null;
  end if;
  if r.attempts >= c_max then
    update public.member_portal_login_attempts
       set attempts = 0, window_start = now(), locked_until = now() + c_lock
     where key = p_key;
    return jsonb_build_object('allowed', false, 'locked_until', now() + c_lock);
  end if;
  update public.member_portal_login_attempts
     set attempts = r.attempts + 1, window_start = r.window_start, locked_until = null
   where key = p_key;
  return jsonb_build_object('allowed', true, 'remaining', c_max - r.attempts - 1);
end;
$$;

create or replace function public.member_portal_login_success(p_key text) returns void
  language sql security definer set search_path to ''
as $$
  delete from public.member_portal_login_attempts where key = p_key;
$$;

create or replace function public.member_portal_end_sessions(p_user uuid) returns void
  language sql security definer set search_path to ''
as $$
  delete from auth.sessions where user_id = p_user;
$$;

revoke execute on function public.member_portal_login_begin(text) from public, anon, authenticated;
revoke execute on function public.member_portal_login_success(text) from public, anon, authenticated;
revoke execute on function public.member_portal_end_sessions(uuid) from public, anon, authenticated;
grant execute on function public.member_portal_login_begin(text) to service_role;
grant execute on function public.member_portal_login_success(text) to service_role;
grant execute on function public.member_portal_end_sessions(uuid) to service_role;

insert into public.app_migrations (version, name) values ('123', 'member_portal_login_lockout')
  on conflict (version) do nothing;

commit;

-- VERIFY: select has_function_privilege('anon', 'public.member_portal_login_begin(text)', 'execute');  → false
--         select has_function_privilege('service_role', 'public.member_portal_login_begin(text)', 'execute');  → true
