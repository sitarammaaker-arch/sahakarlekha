-- 023 · get_error_log() — read the runtime error sink from inside the app (audit P0-2 · in-app viewer).
--
-- error_log (migration 018) has NO select policy — tenants must never read it (it can hold another
-- society's error text), so until now it was only readable by the service role in the SQL editor.
-- This SECURITY DEFINER function lets the PLATFORM ADMIN (and only them — same is_platform_admin()
-- gate as the other cross-tenant RPCs) read recent errors in the SuperAdmin dashboard.
--
-- Returns the list-view columns only (not stack/context) to keep the payload light; the message
-- usually carries the key detail. Newest first, capped 1..500.
--
-- Run once in the Supabase SQL editor.

create or replace function get_error_log(p_limit int default 100)
returns table (
  id          text,
  created_at  timestamptz,
  source      text,
  message     text,
  url         text,
  society_id  text,
  actor_name  text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select e.id, e.created_at, e.source, e.message, e.url, e.society_id, e.actor_name
    from error_log e
    order by e.created_at desc
    limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

revoke execute on function get_error_log(int) from public, anon;
grant  execute on function get_error_log(int) to authenticated;
