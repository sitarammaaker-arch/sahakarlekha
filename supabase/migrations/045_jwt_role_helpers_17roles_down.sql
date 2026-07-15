-- 045 down · restore the migration-029 helper bodies verbatim (legacy roles only).
create or replace function public.jwt_can_write() returns boolean
language sql stable set search_path = public as $$
  select auth.jwt() ->> 'user_role' is null
      or auth.jwt() ->> 'user_role' in ('admin', 'accountant');
$$;

create or replace function public.jwt_can_delete() returns boolean
language sql stable set search_path = public as $$
  select auth.jwt() ->> 'user_role' is null
      or auth.jwt() ->> 'user_role' = 'admin';
$$;

grant execute on function public.jwt_can_write()  to authenticated, anon;
grant execute on function public.jwt_can_delete() to authenticated, anon;
