-- Migration 116 DOWN — drop the partitioned-table tenant policies added by 116.
do $$
declare r record;
begin
  for r in select n.nspname sch, c.relname tbl from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname like 'pay\_%' and c.relkind='p'
      and exists (select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='society_id' and not a.attisdropped)
  loop
    execute format('drop policy if exists %I on %I.%I', r.tbl||'_sel', r.sch, r.tbl);
    execute format('drop policy if exists %I on %I.%I', r.tbl||'_ins', r.sch, r.tbl);
  end loop;
end$$;
