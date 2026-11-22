-- DB-01: a deterministic, read-only description of the public schema (tables, columns, keys, checks, indexes, RLS
-- policies, triggers, functions, grants on tables). Run by scripts/schema-snapshot.mjs; never writes anything.
begin transaction read only;
select json_build_object('lines', (select json_agg(l order by l) from (
  -- tables + RLS flag
  select format('table %s rls=%s force=%s', c.relname, c.relrowsecurity, c.relforcerowsecurity) as l
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p')
  union all
  -- columns
  select format('column %s.%s %s%s%s', c.relname, a.attname, format_type(a.atttypid, a.atttypmod),
                case when a.attnotnull then ' not null' else '' end,
                coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), ''))
    from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
   where n.nspname = 'public' and c.relkind in ('r', 'p') and a.attnum > 0 and not a.attisdropped
  union all
  -- constraints (pk / unique / fk / check / exclusion)
  select format('constraint %s.%s %s', c.relname, k.conname, pg_get_constraintdef(k.oid))
    from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
  union all
  -- indexes not backing a constraint
  select format('index %s', pg_get_indexdef(i.indexrelid))
    from pg_index i join pg_class ic on ic.oid = i.indexrelid join pg_class c on c.oid = i.indrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and not exists (select 1 from pg_constraint k where k.conindid = i.indexrelid)
  union all
  -- RLS policies
  select format('policy %s.%s %s %s to %s using (%s) check (%s)', p.tablename, p.policyname, p.permissive, p.cmd,
                array_to_string(p.roles, ','), coalesce(p.qual, ''), coalesce(p.with_check, ''))
    from pg_policies p where p.schemaname = 'public'
  union all
  -- triggers
  select format('trigger %s', pg_get_triggerdef(t.oid))
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and not t.tgisinternal
  union all
  -- functions: signature + properties + a digest of the body (the full body lives in the migrations)
  select format('function %s(%s) returns %s %s%s volatility=%s body_md5=%s', p.proname,
                pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid),
                case when p.prosecdef then 'security definer' else 'security invoker' end,
                coalesce(' set ' || array_to_string(p.proconfig, ','), ''),
                p.provolatile, md5(p.prosrc))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind in ('f', 'p')
     and not exists (select 1 from pg_depend dp where dp.objid = p.oid and dp.deptype = 'e')   -- skip extension members
  union all
  -- table privileges for the API roles
  select format('grant %s.%s %s', g.table_name, g.grantee, string_agg(g.privilege_type, ',' order by g.privilege_type))
    from information_schema.role_table_grants g
   where g.table_schema = 'public' and g.grantee in ('anon', 'authenticated', 'service_role')
   group by g.table_name, g.grantee
  union all
  -- function execute rights for the API roles
  select format('execute %s(%s) %s', p.proname, pg_get_function_identity_arguments(p.oid),
                concat_ws(',',
                  case when has_function_privilege('anon', p.oid, 'execute') then 'anon' end,
                  case when has_function_privilege('authenticated', p.oid, 'execute') then 'authenticated' end))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind in ('f', 'p')
     and not exists (select 1 from pg_depend dp where dp.objid = p.oid and dp.deptype = 'e')
  union all
  -- the migrations production has applied, so a check can tell a not-yet-run migration from a missing table
  select format('applied_migration %s', m.version) from public.app_migrations m
) s)) as r;
rollback;
