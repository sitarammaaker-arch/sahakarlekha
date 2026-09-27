-- 075 down · put every 4406 / 4407 row 075 changed back exactly as it was (from
-- account_reclass_log), then forget the log rows. The app is unaffected either way: it applies
-- the same classification in memory (ACCOUNT_PATCHES) — only DB-reading reports change back.
begin;

update public.accounts a
set type                 = l.old_row->>'type',
    "parentId"           = l.old_row->>'parentId',
    subtype              = l.old_row->>'subtype',
    "openingBalanceType" = l.old_row->>'openingBalanceType',
    "isSystem"           = (l.old_row->>'isSystem')::boolean,
    name                 = l.old_row->>'name',
    "nameHi"             = l.old_row->>'nameHi'
from public.account_reclass_log l
where l.migration = '075' and l.society_id = a.society_id and l.account_id = a.id;

delete from public.account_reclass_log where migration = '075';

do $$
begin
  if not exists (select 1 from public.account_reclass_log) then
    drop table public.account_reclass_log;
  end if;
end $$;

delete from public.app_migrations where version = '075';

commit;
