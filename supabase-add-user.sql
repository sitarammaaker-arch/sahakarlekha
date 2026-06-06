-- ============================================================================
--  SahakarLekha — Atomic "add society user" (app_add_society_user RPC)
-- ----------------------------------------------------------------------------
--  Phase-3 Step 1: when an admin adds a new user in the app, create EVERYTHING
--  server-side in ONE transaction:
--    1. a CONFIRMED Supabase Auth login (auth.users) with bcrypt password, and
--    2. its email identity (auth.identities) — without this, signInWithPassword
--       fails silently and the user can log in (RPC fallback) but sees no data
--       under society-scoped RLS, and
--    3. the society_users row (linked by email, same society).
--
--  Why an RPC (not client-side auth.signUp):
--    - auth.signUp would swap the admin's own session to the new user.
--    - auth.signUp can create an UNCONFIRMED user (cannot log in until confirmed).
--    - Failures were swallowed -> a society_users row with no working login.
--  This function runs as the definer (bypasses RLS), is granted ONLY to the
--  authenticated role, and self-checks that the caller is an admin of the target
--  society. It NEVER touches an existing auth user (no password-reset vector).
--
--  Run in: Supabase Dashboard -> SQL Editor.
-- ============================================================================

create extension if not exists pgcrypto;

create or replace function public.app_add_society_user(
  p_email      text,
  p_password   text,
  p_name       text,
  p_role       text,
  p_society_id text,
  p_is_active  boolean default true
)
returns text                       -- the new society_users.id
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_caller text := lower(auth.jwt() ->> 'email');
  v_email  text := lower(trim(p_email));
  v_uid    uuid;
  v_su_id  uuid;
begin
  -- 1. Authorization: caller must be an active admin of this society.
  --    (v_caller is null only in trusted service/SQL context — allowed.)
  if v_caller is not null and not public.is_society_admin(p_society_id) then
    raise exception 'Only an admin of this society can add users';
  end if;

  -- 2. Validation
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Valid email required';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'A login already exists for %', v_email;   -- never modify it
  end if;
  if exists (select 1 from public.society_users where lower(email) = v_email) then
    raise exception 'A user already exists for %', v_email;
  end if;

  -- 3. Create the Supabase Auth login (CONFIRMED) + email identity.
  --    NOTE: the *_token / email_change / phone_change columns MUST be '' (empty
  --    string), NOT NULL — gotrue's sign-in scans them as strings and throws on
  --    NULL. This is exactly why a half-built (SQL) auth row logs in only via the
  --    RPC fallback (no JWT) and then sees no data under RLS.
  v_uid := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    v_email, crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('name', coalesce(p_name, '')),
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, created_at, updated_at
  ) values (
    gen_random_uuid(), v_uid, v_uid::text,
    jsonb_build_object('sub', v_uid::text, 'email', v_email,
                       'email_verified', true, 'phone_verified', false),
    'email', now(), now()
  );

  -- 4. Create the app user row (id auto-generated). Linked by email + society.
  insert into public.society_users (name, email, password, role, society_id, is_active)
  values (p_name, v_email, p_password, p_role, p_society_id::uuid, coalesce(p_is_active, true))
  returning id into v_su_id;

  return v_su_id::text;
end;
$fn$;

revoke all on function public.app_add_society_user(text, text, text, text, text, boolean) from public;
grant execute on function public.app_add_society_user(text, text, text, text, text, boolean) to authenticated;


-- ── SELF-TEST (creates a throwaway user in the Rania society, verifies, cleans up)
--    Watch the "Messages"/Notices output: expect confirmed=t, identities=1.
do $$
declare v_id text; v_uid uuid; v_conf boolean; v_ident int; v_sid text;
begin
  select id::text into v_sid from public.societies where name ilike '%Rania%' limit 1;
  if v_sid is null then raise notice 'SELFTEST skipped: no Rania society found'; return; end if;

  v_id := public.app_add_society_user(
    'selftest_delete_me@sahakarlekha.local', 'SelfTest@123', 'SELFTEST DELETE',
    'viewer', v_sid, true);

  select au.id, (au.email_confirmed_at is not null),
         (select count(*) from auth.identities i where i.user_id = au.id)
    into v_uid, v_conf, v_ident
    from auth.users au where au.email = 'selftest_delete_me@sahakarlekha.local';

  raise notice 'SELFTEST -> society_user_id=%, confirmed=%, identities=% (expect: id set, t, 1)',
               v_id, v_conf, v_ident;

  -- cleanup
  delete from public.society_users where lower(email) = 'selftest_delete_me@sahakarlekha.local';
  delete from auth.identities where user_id = v_uid;
  delete from auth.users where id = v_uid;
  raise notice 'SELFTEST cleaned up OK.';
end $$;
