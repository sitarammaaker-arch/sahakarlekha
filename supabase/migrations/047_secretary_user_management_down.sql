-- 047 down · revert S7 — restore admin-only user management.
-- Restore app_add_society_user's original admin-only authorization (no p_role guard needed
-- once only admins can call it), drop the secretary policy + the narrow gate.
create or replace function public.app_add_society_user(
  p_email      text,
  p_password   text,
  p_name       text,
  p_role       text,
  p_society_id text,
  p_is_active  boolean default true
)
returns text
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
  if v_caller is not null and not public.is_society_admin(p_society_id) then
    raise exception 'Only an admin of this society can add users';
  end if;
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
  insert into public.society_users (name, email, password, role, society_id, is_active)
  values (p_name, v_email, p_password, p_role, p_society_id::uuid, coalesce(p_is_active, true))
  returning id into v_su_id;
  return v_su_id::text;
end;
$fn$;
revoke all on function public.app_add_society_user(text, text, text, text, text, boolean) from public;
grant execute on function public.app_add_society_user(text, text, text, text, text, boolean) to authenticated;

drop policy if exists "society_users_secretary" on public.society_users;
drop function if exists public.is_society_user_manager(text);
