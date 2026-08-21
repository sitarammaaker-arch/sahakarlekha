-- 056 · Phase 2a-3 — server-side seat-cap enforcement in app_add_society_user.
--
-- Hardens the client affordance (2a-2): the add-user RPC now rejects a NEW user
-- once the society's active-user count reaches its plan's seats_limit. This is the
-- real gate — the raw REST/RPC path can no longer bypass it.
--
-- seats_limit lives on public.subscriptions (055): null = unlimited (legacy / pro),
-- so this is DORMANT for every currently-grandfathered society and only bites once a
-- Starter (1) / Plus (6) plan is activated for a society. Verbatim reproduction of
-- the 047 function with ONLY: two new declares (v_seats/v_count) + the seat-cap
-- block (marked 2a-3). Reversible via 056_seat_cap_enforcement_down.sql (restores 047).

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

  -- 2a-3: plan seat cap. seats_limit null (legacy/pro) → skip. Active users only.
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
$fn$;
revoke all on function public.app_add_society_user(text, text, text, text, text, boolean) from public;
grant execute on function public.app_add_society_user(text, text, text, text, text, boolean) to authenticated;
