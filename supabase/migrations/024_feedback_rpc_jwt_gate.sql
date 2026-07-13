-- 024 · re-gate the feedback-admin RPCs on is_platform_admin() (fix for slice-S4 regression).
--
-- Migrations 003/004 defined admin_feedback_list / _set_status / _set_public to authorize by calling
-- verify_platform_admin(p_email, p_password) — because platform-admin sessions used to be JWT-less.
-- Slice S4 (migration 022) DROPPED verify_platform_admin (and the plaintext platform_admins.password),
-- now that platform admins sign in via real Supabase Auth (JWT). That silently broke these three RPCs
-- (the nested call to a dropped function errors), so the Feedback Inbox stopped unlocking.
--
-- Fix: authorize with is_platform_admin() (the JWT-based predicate, migration 019) — the same gate the
-- other cross-tenant super-admin RPCs use. Signatures are UNCHANGED so the client keeps working; the
-- p_email / p_password params are now ignored (the verified JWT is authoritative). EXECUTE is revoked
-- from anon (a platform admin now always has a JWT) and kept for authenticated.
--
-- Run once in the Supabase SQL editor.

create or replace function public.admin_feedback_list(p_email text, p_password text)
returns setof feedback
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if not is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select f.* from public.feedback f
    order by f.created_at desc
    limit 500;
end;
$$;

create or replace function public.admin_feedback_set_status(
  p_email text, p_password text, p_id uuid, p_status text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_status not in ('new', 'seen', 'resolved') then
    raise exception 'invalid status';
  end if;
  update public.feedback set status = p_status where id = p_id;
end;
$$;

create or replace function public.admin_feedback_set_public(
  p_email text, p_password text, p_id uuid, p_is_public boolean
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.feedback set is_public = p_is_public where id = p_id;
end;
$$;

revoke execute on function public.admin_feedback_list(text, text)                    from anon;
revoke execute on function public.admin_feedback_set_status(text, text, uuid, text)  from anon;
revoke execute on function public.admin_feedback_set_public(text, text, uuid, boolean) from anon;
