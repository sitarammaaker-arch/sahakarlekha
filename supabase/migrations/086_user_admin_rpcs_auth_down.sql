-- 086 undo · restores the pre-086 bodies and grants EXACTLY. WARNING: re-opens the anon takeover.

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
  -- 1. Authorization: caller must be an active admin OR secretary of this society (S7).
  if v_caller is not null and not public.is_society_user_manager(p_society_id) then
    raise exception 'Only an admin or secretary of this society can add users';
  end if;
  -- S7 escalation guard: only a full admin may create another admin.
  if p_role = 'admin' and v_caller is not null and not public.is_society_admin(p_society_id) then
    raise exception 'Only an admin can create an admin user';
  end if;

  -- 2a-3: plan seat cap. seats_limit null (legacy/pro) â†’ skip. Active users only.
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

CREATE OR REPLACE FUNCTION public.app_reset_society_user_password(p_su_id text, p_password text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_caller     text := lower(auth.jwt() ->> 'email');
  v_email      text;
  v_society_id text;
  v_rows       int;
begin
  if p_password is null or length(p_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;

  -- Resolve the target user (inactive rows included â€” reset-then-reactivate is a
  -- legitimate admin flow; an inactive user still can't use the app).
  select lower(su.email), su.society_id::text
    into v_email, v_society_id
    from public.society_users su
   where su.id::text = p_su_id;
  if v_email is null then
    raise exception 'User not found';
  end if;

  -- Authorization: caller must be an active admin of the target user's society.
  -- (v_caller is null only in trusted service/SQL context â€” allowed, same as
  -- app_add_society_user.)
  if v_caller is not null and not public.is_society_admin(v_society_id) then
    raise exception 'Only an admin of this society can reset passwords';
  end if;

  -- G1: a platform admin's login can never be reset from a society dialog.
  if exists (select 1 from public.platform_admins pa where lower(pa.email) = v_email) then
    raise exception 'This login cannot be reset from here';
  end if;

  -- G2: refuse if the email also belongs to another society (forged-row /
  -- cross-tenant takeover guard â€” see header).
  if exists (select 1 from public.society_users su2
              where lower(su2.email) = v_email
                and su2.society_id::text <> v_society_id) then
    raise exception 'This email is shared with another society; reset is not allowed';
  end if;

  -- The real credential store. society_users.password is intentionally NOT
  -- touched (012's trigger force-blanks it anyway).
  update auth.users
     set encrypted_password = crypt(p_password, gen_salt('bf')),
         updated_at = now()
   where lower(email) = v_email;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    -- Legacy society_users row with no auth login: nothing to reset. Surface it
    -- instead of pretending success â€” the admin should re-create this user.
    raise exception 'No login exists for this user yet â€” delete and re-add the user to create one';
  end if;

  return true;
end;
$function$;

grant execute on function public.app_add_society_user(text, text, text, text, text, boolean) to public, anon, authenticated;
grant execute on function public.app_reset_society_user_password(text, text)                to public, anon, authenticated;

delete from public.app_migrations where version = '086';

commit;
