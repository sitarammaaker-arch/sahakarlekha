-- ============================================================================
-- 094 · Security: anon EXECUTE on SECURITY DEFINER functions + stop writing plain-text passwords
-- ============================================================================
-- Audit 2026-10-02 (docs/audits/PUBLIC-CLAIMS-AUDIT-2026-10.md §C), re-verified on prod read-only:
--
-- A. society_users.password — app_register_admin, app_add_society_user and app_set_my_password still
--    passed the RAW password into society_users. Trigger trg_force_blank_su_password (012) blanks it
--    on every write, so prod holds 0 non-blank values (37 users) — but the functions should not hand
--    the secret to that table at all. They now write '' (app_set_my_password no longer touches it).
--    Dropping the column + the 012 trigger is a separate, later step (095).
--
-- B. Supabase's default privileges grant EXECUTE on every new public function to anon. Revoked here
--    for definer functions anon never needs:
--      · app_register_admin   — only caller is register_society, which runs as its owner (postgres),
--                               so the nested call is unaffected. Revoked from authenticated too:
--                               a direct call bypasses register_society's checks.
--      · app_set_my_password  — ResetPassword runs inside a recovery session (authenticated).
--      · pay_payslip_lines    — Payroll page is signed-in only (117 granted authenticated explicitly).
--      · tg_new_society_trial — a trigger function; firing a trigger does not check EXECUTE.
--      · society_has_users    — its only anon use was the policy below.
--
-- C. Policy society_users_bootstrap (anon INSERT of an 'admin' row into a society with no users) is a
--    leftover of the pre-RPC signup. register_society inserts as its owner (postgres, BYPASSRLS, no
--    FORCE RLS), so signup does not depend on it. Dropped.
--
-- Kept for anon on purpose: register_society (signup), increment_blog_view, public_reviews,
-- issue_certificate, verify_certificate (public pages), and the JWT-derived RLS helpers.
--
-- Function bodies are prod's pg_get_functiondef (2026-10-02) with only the changes marked "094".
-- Idempotent. Undo: 094_definer_exec_and_password_writes_down.sql.
-- ============================================================================

begin;

CREATE OR REPLACE FUNCTION public.app_add_society_user(p_email text, p_password text, p_name text, p_role text, p_society_id text, p_is_active boolean DEFAULT true)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_caller text := lower(auth.jwt() ->> 'email');
  v_email  text := lower(trim(p_email));
  v_uid    uuid;
  v_su_id  uuid;
  v_seats  int;   -- 2a-3: plan seat cap (null = unlimited)
  v_count  int;   -- 2a-3: current active users
begin
  -- 0. A caller with no verified JWT email (anon) is never authorized (086 · A5).
  if v_caller is null or v_caller = '' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  -- 1. Authorization: caller must be an active admin OR secretary of this society (S7).
  if not public.is_society_user_manager(p_society_id) then
    raise exception 'Only an admin or secretary of this society can add users';
  end if;
  -- S7 escalation guard: only a full admin may create another admin.
  if p_role = 'admin' and not public.is_society_admin(p_society_id) then
    raise exception 'Only an admin can create an admin user';
  end if;

  -- 2a-3: plan seat cap. seats_limit null (legacy/pro) -> skip. Active users only.
  select seats_limit into v_seats from public.subscriptions where society_id = p_society_id;
  if v_seats is not null then
    select count(*) into v_count from public.society_users
      where society_id::text = p_society_id and is_active;
    if v_count >= v_seats then
      raise exception 'Plan seat limit reached (% user(s)). Upgrade to Plus or Pro to add more.', v_seats;
    end if;
  end if;

  -- 2. Validation
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Valid email required';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'A login already exists for %', v_email;
  end if;
  if exists (select 1 from public.society_users where lower(email) = v_email) then
    raise exception 'A user already exists for %', v_email;
  end if;

  -- 3. Create the Supabase Auth login (CONFIRMED) + email identity.
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

  -- 4. Create the app user row.
  -- 094: society_users.password is a dead legacy column; the credential lives only in auth.users.
  insert into public.society_users (name, email, password, role, society_id, is_active)
  values (p_name, v_email, '', p_role, p_society_id::uuid, coalesce(p_is_active, true))
  returning id into v_su_id;

  return v_su_id::text;
end;
$function$;

CREATE OR REPLACE FUNCTION public.app_register_admin(p_email text, p_password text, p_name text, p_society_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_email text := lower(trim(p_email));
  v_uid   uuid;
  v_su_id uuid;
begin
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Valid email required'; end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Password must be at least 6 characters'; end if;
  if public.society_has_users(p_society_id) then
    raise exception 'This society already has users'; end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'A login already exists for %', v_email; end if;
  if exists (select 1 from public.society_users where lower(email) = v_email) then
    raise exception 'A user already exists for %', v_email; end if;

  v_uid := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    v_email, crypt(p_password, gen_salt('bf')), now(), now(), now(),
    jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
    jsonb_build_object('name', coalesce(p_name,'')),
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

  insert into public.society_users (name, email, password, role, society_id, is_active)
  -- 094: society_users.password is a dead legacy column; the credential lives only in auth.users.
  values (p_name, v_email, '', 'admin', p_society_id::uuid, true)
  returning id into v_su_id;

  return v_su_id::text;
end;
$function$;

CREATE OR REPLACE FUNCTION public.app_set_my_password(p_password text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  v_rows  int;
begin
  -- Identity comes from the JWT (recovery session), never a parameter.
  -- So this can only ever change the CALLER's own password.
  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;

  -- 094: society_users.password is no longer written (app_login was dropped in 010). The return
  -- value keeps its meaning: does the caller have a society_users row?
  select count(*) into v_rows from public.society_users where lower(email) = v_email;

  -- Keep Supabase Auth (JWT login) in sync. Idempotent + safe.
  update auth.users
     set encrypted_password = crypt(p_password, gen_salt('bf')),
         updated_at = now()
   where lower(email) = v_email;

  return v_rows > 0;
end;
$function$;

revoke execute on function public.app_register_admin(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.app_set_my_password(text)                   from public, anon;
revoke execute on function public.pay_payslip_lines(uuid)                     from public, anon;
revoke execute on function public.tg_new_society_trial()                      from public, anon, authenticated;

drop policy if exists society_users_bootstrap on public.society_users;
revoke execute on function public.society_has_users(text)                     from public, anon;

commit;
