-- ============================================================================
-- 094 · ROLLBACK — restore the pre-094 function bodies, grants and the anon bootstrap policy
-- ============================================================================
-- WARNING: restores the raw-password writes into society_users (still blanked by the 012 trigger
-- while it exists) and anon EXECUTE on the functions below. Bodies = prod pg_get_functiondef
-- captured 2026-10-02 before 094.
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
  insert into public.society_users (name, email, password, role, society_id, is_active)
  values (p_name, v_email, p_password, p_role, p_society_id::uuid, coalesce(p_is_active, true))
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
  values (p_name, v_email, p_password, 'admin', p_society_id::uuid, true)
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

  -- 1. Sync the app's RPC-login store (plain-text, read by app_login()).
  update public.society_users
     set password = p_password
   where lower(email) = v_email;
  get diagnostics v_rows = row_count;

  -- 2. Keep Supabase Auth (JWT login) in sync too. Idempotent + safe.
  update auth.users
     set encrypted_password = crypt(p_password, gen_salt('bf')),
         updated_at = now()
   where lower(email) = v_email;

  return v_rows > 0;
end;
$function$;

grant execute on function public.app_register_admin(text, text, text, text) to anon, authenticated;
grant execute on function public.app_set_my_password(text)                   to anon;
grant execute on function public.pay_payslip_lines(uuid)                     to public, anon;
grant execute on function public.tg_new_society_trial()                      to public, anon, authenticated;
grant execute on function public.society_has_users(text)                     to public, anon;

drop policy if exists society_users_bootstrap on public.society_users;
create policy society_users_bootstrap on public.society_users
  as permissive for insert to anon
  with check ((role = 'admin'::text) and (not public.society_has_users((society_id)::text)));

commit;
