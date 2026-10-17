-- 119 · Member photograph + correspondence address (member-area audit M6, 2026-10-17).
--
-- WHY: Haryana Co-operative Societies Act 1984 s.40 proviso — every individual member of a primary society furnishes
-- a photograph, a permanent address and a correspondence address, and reports changes within 15 days. The app kept
-- one address and no photograph.
--
-- WHAT:
--   (1) two nullable text columns on members: "correspondenceAddress", "photoPath" (no existing row is touched; the
--       app writes them in their own updates, so members keep saving before this runs — RULE 1);
--   (2) a PRIVATE storage bucket 'member-photos' (1 MB per file, images only) — photos are personal data, never public;
--   (3) storage policies: a society's own users read their society's photos; its writers (jwt_can_write) add /
--       replace / remove them. A photo's path starts with the society id (`<society id>/<member id>.jpg`), checked
--       against current_user_society_ids() — the same tenant rule as every members row.
-- Undo: 119_member_photo_contact_down.sql.

begin;

alter table public.members add column if not exists "correspondenceAddress" text;
alter table public.members add column if not exists "photoPath"             text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-photos', 'member-photos', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "member_photos_select" on storage.objects;
create policy "member_photos_select" on storage.objects for select to authenticated
  using (bucket_id = 'member-photos' and (storage.foldername(name))[1] in (select public.current_user_society_ids()));

drop policy if exists "member_photos_insert" on storage.objects;
create policy "member_photos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'member-photos' and (storage.foldername(name))[1] in (select public.current_user_society_ids()) and public.jwt_can_write());

drop policy if exists "member_photos_update" on storage.objects;
create policy "member_photos_update" on storage.objects for update to authenticated
  using (bucket_id = 'member-photos' and (storage.foldername(name))[1] in (select public.current_user_society_ids()) and public.jwt_can_write())
  with check (bucket_id = 'member-photos' and (storage.foldername(name))[1] in (select public.current_user_society_ids()) and public.jwt_can_write());

drop policy if exists "member_photos_delete" on storage.objects;
create policy "member_photos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'member-photos' and (storage.foldername(name))[1] in (select public.current_user_society_ids()) and public.jwt_can_write());

insert into public.app_migrations (version, name) values ('119', 'member_photo_contact')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
