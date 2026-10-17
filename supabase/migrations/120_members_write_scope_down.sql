-- 120 down · back to the 031 members write policies (jwt_can_write), no FY-lock trigger, no member-number index.
-- Restores the photo storage policies of 119. Nothing in the data changes.
begin;

drop policy if exists members_tenant_insert on public.members;
create policy members_tenant_insert on public.members for insert
  with check ((society_id in (select current_user_society_ids())) and jwt_can_write());

drop policy if exists members_tenant_update on public.members;
create policy members_tenant_update on public.members for update
  using ((society_id in (select current_user_society_ids())) and jwt_can_write())
  with check ((society_id in (select current_user_society_ids())) and jwt_can_write());

drop policy if exists members_tenant_delete on public.members;
create policy members_tenant_delete on public.members for delete
  using ((society_id in (select current_user_society_ids())) and jwt_can_delete());

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

drop trigger if exists members_fy_lock_guard on public.members;
drop function if exists public.members_fy_lock_guard();
drop index if exists public.members_society_memberid_live_uq;
drop function if exists public.jwt_can_write_members();

delete from public.app_migrations where version = '120';
commit;
notify pgrst, 'reload schema';
