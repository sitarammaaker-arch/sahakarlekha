-- 163 down · put the old names back (from account_reclass_log). The app's own rename (storage.ts) still shows
-- the new name on screen — revert the code as well if that is the intent.
begin;
update public.accounts a
   set name = l.old_row->>'name'
  from public.account_reclass_log l
 where l.migration = '163' and a.society_id::text = l.society_id and a.id = l.account_id;
delete from public.account_reclass_log where migration = '163';
delete from public.app_migrations where version = '163';
commit;
notify pgrst, 'reload schema';
