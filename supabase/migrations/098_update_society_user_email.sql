-- 098 · app_update_society_user_email(): change a user's email in society_users AND in Supabase Auth.
--
-- Why: User Management's edit updated society_users.email only. The Auth login kept the old email, so
-- the user signed in to Auth fine but the app found no society_users row for that email and showed
-- "Invalid email or password" — even right after a successful password reset (Rania admin,
-- 2026-10-02). The two must change together, in one transaction, by the server.
--
-- Guards (same shape as 041 app_reset_society_user_password):
--   • caller must be an active admin of the target's society (is_society_admin);
--   • platform-admin logins are never touched from here;
--   • the old email must not be shared with another society;
--   • the new email must be valid and not used by any other login or society user.
-- Updates auth.users.email + the email identity's identity_data (auth.identities.email is generated
-- from it), then society_users.email, and writes an audit_log row. Idempotent for an unchanged email.
-- Down: 098_update_society_user_email_down.sql.

begin;

create or replace function public.app_update_society_user_email(
  p_su_id     text,   -- society_users.id of the user being changed
  p_new_email text
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_new        text := lower(trim(p_new_email));
  v_old        text;
  v_society_id text;
  v_auth_id    uuid;
  v_actor      text := lower(auth.jwt() ->> 'email');
begin
  if v_new is null or v_new !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Valid email required';
  end if;

  select lower(su.email), su.society_id::text into v_old, v_society_id
    from public.society_users su where su.id::text = p_su_id;
  if v_old is null then
    raise exception 'User not found';
  end if;

  if not public.is_society_admin(v_society_id) then
    raise exception 'Only an admin of this society can change a user''s email';
  end if;

  if v_new = v_old then
    return v_new;   -- nothing to change
  end if;

  if exists (select 1 from public.platform_admins pa where lower(pa.email) in (v_old, v_new)) then
    raise exception 'This login cannot be changed from here';
  end if;

  if exists (select 1 from public.society_users su2
              where lower(su2.email) = v_old and su2.society_id::text <> v_society_id) then
    raise exception 'This email is shared with another society; change is not allowed';
  end if;

  if exists (select 1 from auth.users u where lower(u.email) = v_new)
     or exists (select 1 from public.society_users su3 where lower(su3.email) = v_new and su3.id::text <> p_su_id) then
    raise exception 'This email is already in use';
  end if;

  select u.id into v_auth_id from auth.users u where lower(u.email) = v_old;
  if v_auth_id is not null then
    update auth.users set email = v_new, updated_at = now() where id = v_auth_id;
    update auth.identities
       set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v_new)), updated_at = now()
     where user_id = v_auth_id and provider = 'email';
  end if;
  -- No Auth login yet for the old email: only society_users changes (the user gets a login when an
  -- admin resets their password / re-adds them, under the new email).

  update public.society_users set email = v_new where id::text = p_su_id;

  insert into public.audit_log (society_id, actor_email, actor_role, entity_type, entity_id, action, before, after, reason, source)
  values (v_society_id, v_actor, 'admin', 'society_user', p_su_id, 'update',
          jsonb_build_object('email', v_old), jsonb_build_object('email', v_new),
          case when v_auth_id is null then 'email changed (no Auth login yet)' else 'email changed (Auth login updated too)' end,
          'app');

  return v_new;
end;
$fn$;

revoke execute on function public.app_update_society_user_email(text, text) from public, anon;
grant execute on function public.app_update_society_user_email(text, text) to authenticated;

insert into public.app_migrations (version, name) values ('098', 'update_society_user_email')
  on conflict (version) do nothing;

commit;
