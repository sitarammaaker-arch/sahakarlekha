-- 099 undo · removes the recorded catalog version (the code revert restores the older catalog).

begin;

delete from catalog_versions where catalog_name = 'tds' and content_hash = '98270a8826d27783';
delete from public.app_migrations where version = '099';

commit;
