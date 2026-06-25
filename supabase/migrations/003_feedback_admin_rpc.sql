-- ============================================================
-- SahakarLekha — Feedback inbox RPCs (Phase 1 follow-up)
-- Run in Supabase SQL Editor.
--
-- Why: platform-admin sessions in this app are often JWT-less (see
-- supabase-security.sql), so the auth.jwt()-based RLS read policy on
-- `feedback` returns nothing. These SECURITY DEFINER RPCs re-verify the
-- admin via the existing verify_platform_admin(email,password) and then
-- read / update — so the inbox works without a JWT, and PII stays
-- unreadable by anon (wrong password -> "not authorized").
-- ============================================================

-- List feedback (newest first). Raises if the admin password is wrong.
create or replace function public.admin_feedback_list(p_email text, p_password text)
returns setof feedback
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if not exists (select 1 from public.verify_platform_admin(p_email, p_password)) then
    raise exception 'not authorized';
  end if;
  return query
    select f.* from public.feedback f
    order by f.created_at desc
    limit 500;
end;
$$;

revoke all on function public.admin_feedback_list(text, text) from public;
grant execute on function public.admin_feedback_list(text, text) to anon, authenticated;

-- Update one row's status (new | seen | resolved). Admin-verified.
create or replace function public.admin_feedback_set_status(
  p_email text, p_password text, p_id uuid, p_status text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not exists (select 1 from public.verify_platform_admin(p_email, p_password)) then
    raise exception 'not authorized';
  end if;
  if p_status not in ('new', 'seen', 'resolved') then
    raise exception 'invalid status';
  end if;
  update public.feedback set status = p_status where id = p_id;
end;
$$;

revoke all on function public.admin_feedback_set_status(text, text, uuid, text) from public;
grant execute on function public.admin_feedback_set_status(text, text, uuid, text) to anon, authenticated;

-- Test (replace with your real admin email + password):
--   select * from admin_feedback_list('owner@example.com', 'yourpassword');  -- rows
--   select * from admin_feedback_list('owner@example.com', 'wrong');         -- ERROR: not authorized
