-- 093 undo · removes the recorded catalog version (the code revert restores the older catalog).

begin;

delete from catalog_versions where catalog_name = 'tds' and content_hash = '1cef8d5dc06e5e38';
delete from public.app_migrations where version = '093';

commit;
