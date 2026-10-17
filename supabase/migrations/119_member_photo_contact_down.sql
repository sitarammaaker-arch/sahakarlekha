-- 119 down · remove the member-photo policies and columns. The bucket is kept if it still holds photos (delete them in
-- Storage first); an empty bucket is removed. LOSES the recorded correspondence addresses and photo links.
begin;
drop policy if exists "member_photos_select" on storage.objects;
drop policy if exists "member_photos_insert" on storage.objects;
drop policy if exists "member_photos_update" on storage.objects;
drop policy if exists "member_photos_delete" on storage.objects;
delete from storage.buckets b where b.id = 'member-photos' and not exists (select 1 from storage.objects o where o.bucket_id = b.id);
alter table public.members drop column if exists "correspondenceAddress";
alter table public.members drop column if exists "photoPath";
delete from public.app_migrations where version = '119';
commit;
notify pgrst, 'reload schema';
