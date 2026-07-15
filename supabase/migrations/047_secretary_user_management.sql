-- 047 · ECR-06 S7 — delegate USER MANAGEMENT to the secretary role (matrix `userMgmt`),
-- with hard privilege-escalation guards.
--
-- WHY NOT the naive "widen is_society_admin()": is_society_admin backs the `society_users`
-- FOR ALL RLS policy AND the societies/society_settings policies. Widening it to secretary would
-- let a secretary, via the raw REST API, `update society_users set role='admin' where id=<self>`
-- (privilege escalation) or deactivate the admin (lock-out). So is_society_admin STAYS admin-only.
--
-- Instead: a NARROW gate `is_society_user_manager` (admin + secretary) used ONLY for user
-- management, with escalation guards everywhere:
--   • a RESTRICTIVE-shaped permissive policy lets a secretary write society_users rows ONLY when
--     the row's role is NOT 'admin' (both USING and WITH CHECK) — so they can neither touch an
--     admin row nor promote anyone (incl. themselves) to admin via raw API.
--   • app_add_society_user (SECURITY DEFINER bypasses RLS) gets an in-body guard: a non-admin
--     caller cannot create a user with p_role='admin'.
-- Password reset (app_reset_society_user_password) is deliberately LEFT admin-only for now.

-- 1. The narrow user-management gate.
create or replace function public.is_society_user_manager(p_society_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.society_users su
    where lower(su.email) = lower(auth.jwt() ->> 'email')
      and su.society_id::text = p_society_id
      and su.role in ('admin', 'secretary') and su.is_active);
$$;
grant execute on function public.is_society_user_manager(text) to authenticated, anon;

-- 2. RLS: a secretary may manage NON-ADMIN users of their society via the raw API (the
--    UserManagement edit path is a direct society_users update). ORs with the existing
--    admin-only `society_users_admin` policy. The `role <> 'admin'` on BOTH sides blocks a
--    secretary from editing an admin row (USING) or setting/creating role='admin' (WITH CHECK).
drop policy if exists "society_users_secretary" on public.society_users;
create policy "society_users_secretary" on public.society_users for all to authenticated
  using (public.is_society_user_manager(society_id::text) and role <> 'admin')
  with check (public.is_society_user_manager(society_id::text) and role <> 'admin');

-- 3. app_add_society_user — allow secretary, but a non-admin caller can NEVER mint an admin.
--    Verbatim reproduction of supabase-add-user.sql with ONLY the two authorization changes
--    (marked S7); the auth.users/identities/society_users inserts are unchanged.
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
  -- 1. Authorization: caller must be an active admin OR secretary of this society (S7).
  if v_caller is not null and not public.is_society_user_manager(p_society_id) then
    raise exception 'Only an admin or secretary of this society can add users';
  end if;
  -- S7 escalation guard: only a full admin may create another admin.
  if p_role = 'admin' and v_caller is not null and not public.is_society_admin(p_society_id) then
    raise exception 'Only an admin can create an admin user';
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
$fn$;
revoke all on function public.app_add_society_user(text, text, text, text, text, boolean) from public;
grant execute on function public.app_add_society_user(text, text, text, text, text, boolean) to authenticated;
