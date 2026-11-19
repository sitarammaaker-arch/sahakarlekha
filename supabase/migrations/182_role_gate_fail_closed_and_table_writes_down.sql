-- Down for 182 — puts back the fail-open role helpers (045 bodies) and every policy 182 replaced, exactly as it
-- was (from public._rls_182_backup). Run only to undo 182: it re-opens SEC-04 and SEC-03.

begin;

create or replace function public.jwt_can_write() returns boolean
language sql stable set search_path = public as $$
  select auth.jwt() ->> 'user_role' is null
      or auth.jwt() ->> 'user_role' in (
        'admin', 'accountant',
        'societyAdmin', 'manager', 'cashier', 'storeKeeper', 'procurementOfficer',
        'salesOperator', 'secretary', 'employee', 'dataEntry',
        'boardMember', 'chairman'
      );
$$;

create or replace function public.jwt_can_delete() returns boolean
language sql stable set search_path = public as $$
  select auth.jwt() ->> 'user_role' is null
      or auth.jwt() ->> 'user_role' in ('admin', 'societyAdmin', 'secretary');
$$;

do $undo$
declare
  b record;
  nm text;
  to_roles text;
begin
  for b in select * from public._rls_182_backup loop
    foreach nm in array b.created loop
      execute format('drop policy if exists %I on public.%I', nm, b.tablename);
    end loop;
    select string_agg(quote_ident(r), ', ') into to_roles from unnest(b.roles) r;
    if b.cmd = 'INSERT' then
      execute format('create policy %I on public.%I as permissive for insert to %s with check (%s)', b.policyname, b.tablename, to_roles, coalesce(b.with_check, b.qual));
    elsif b.cmd = 'DELETE' then
      execute format('create policy %I on public.%I as permissive for delete to %s using (%s)', b.policyname, b.tablename, to_roles, b.qual);
    else  -- ALL / UPDATE
      execute format('create policy %I on public.%I as permissive for %s to %s using (%s)%s', b.policyname, b.tablename, lower(b.cmd), to_roles, b.qual,
                     case when b.with_check is not null then format(' with check (%s)', b.with_check) else '' end);
    end if;
  end loop;
end
$undo$;

drop table if exists public._rls_182_backup;

delete from public.app_migrations where version = '182';

commit;
