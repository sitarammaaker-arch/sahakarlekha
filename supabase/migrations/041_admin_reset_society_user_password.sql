-- 041 · app_reset_society_user_password — make the admin "reset password" in the
--       Edit User dialog actually work (P1-SEC-5 follow-up).
--
-- WHY: the UserManagement edit path wrote form.password to society_users.password —
-- a dead legacy column that P1-SEC-5 stopped reading (011 wiped it, 012's trigger
-- force-blanks every write). Real logins live in auth.users (bcrypt). So an admin
-- "resetting" a user's password changed NOTHING about the actual login: the user
-- kept logging in with the old password. Misleading + a support trap.
--
-- WHAT: a SECURITY DEFINER RPC, sibling of app_add_society_user (supabase-add-user.sql)
-- and app_set_my_password (supabase-reset-password.sql), that rewrites
-- auth.users.encrypted_password for a society user — after verifying the caller is
-- an active admin of THAT user's society.
--
-- SECURITY — why the extra guards:
--   The society_users_admin RLS policy lets a society admin insert a society_users
--   row with ANY email (only society_id is constrained). Without guards, an admin of
--   society A could forge a row carrying victim@society-b.com and "reset" it —
--   taking over a real login of another tenant (or a platform admin). Therefore:
--     G1. never touch an email that is a platform admin;
--     G2. never touch an email that also has a society_users row in ANY other
--         society (cross-tenant emails are out of an admin's blast radius).
--   Identity/authorization comes from auth.jwt() exactly like the sibling RPCs
--   (society admins have real JWTs; the null-caller allowance mirrors
--   app_add_society_user and only applies in trusted service/SQL context —
--   the grant below is authenticated-only, and every authenticated session in
--   this email-auth app carries an email claim).
--
-- Run in: Supabase Dashboard → SQL Editor.

create extension if not exists pgcrypto;

create or replace function public.app_reset_society_user_password(
  p_su_id    text,   -- society_users.id of the user being reset
  p_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_caller     text := lower(auth.jwt() ->> 'email');
  v_email      text;
  v_society_id text;
  v_rows       int;
begin
  if p_password is null or length(p_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;

  -- Resolve the target user (inactive rows included — reset-then-reactivate is a
  -- legitimate admin flow; an inactive user still can't use the app).
  select lower(su.email), su.society_id::text
    into v_email, v_society_id
    from public.society_users su
   where su.id::text = p_su_id;
  if v_email is null then
    raise exception 'User not found';
  end if;

  -- Authorization: caller must be an active admin of the target user's society.
  -- (v_caller is null only in trusted service/SQL context — allowed, same as
  -- app_add_society_user.)
  if v_caller is not null and not public.is_society_admin(v_society_id) then
    raise exception 'Only an admin of this society can reset passwords';
  end if;

  -- G1: a platform admin's login can never be reset from a society dialog.
  if exists (select 1 from public.platform_admins pa where lower(pa.email) = v_email) then
    raise exception 'This login cannot be reset from here';
  end if;

  -- G2: refuse if the email also belongs to another society (forged-row /
  -- cross-tenant takeover guard — see header).
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
    -- instead of pretending success — the admin should re-create this user.
    raise exception 'No login exists for this user yet — delete and re-add the user to create one';
  end if;

  return true;
end;
$fn$;

revoke all on function public.app_reset_society_user_password(text, text) from public;
grant execute on function public.app_reset_society_user_password(text, text) to authenticated;
