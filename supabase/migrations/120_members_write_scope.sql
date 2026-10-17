-- 120 · members: writes only by the member-office roles, the FY lock on the server, one live member number per
--       society (member-area re-audit 2026-10-17, stage B — H-4, M-5).
--
-- WHY (verified read-only on prod 2026-10-17):
--   (1) members INSERT / UPDATE policies use jwt_can_write(), which admits cashier, storeKeeper, procurementOfficer,
--       salesOperator, employee, dataEntry, boardMember, chairman — and a token with NO role claim. None of those roles
--       has the Members module; the page gate was the only thing stopping a direct PostgREST write (phone, nominee,
--       shareCapital, status, a soft-delete — which is an UPDATE).
--   (2) no trigger on members: the FY audit-lock was a browser check only.
--   (3) no unique index on (society_id, "memberId"); numbers are max+1 in the browser, so two users adding at once
--       could both save "M-101". Prod has 0 duplicates today (incl. deleted rows), so the index builds cleanly.
--
-- WHAT:
--   (1) jwt_can_write_members(): admin, societyAdmin, accountant, secretary, manager — the same five roles that may read
--       PII (jwt_can_read_pii, 106). FAIL-CLOSED on a missing role claim (founder decision 2026-10-17: every active
--       society user on prod has a role, and the access-token hook always sets it for them). The member-photo storage
--       writes use it too.
--   (2) members_fy_lock_guard: a BEFORE INSERT/UPDATE/DELETE trigger that refuses any change while the society's
--       financial year is audit-locked (society_settings."fyLocked"). Service-role jobs and the SQL editor (no JWT)
--       are not blocked — restores, rehearsals and founder fixes keep working.
--   (3) members_society_memberid_live_uq: unique (society_id, "memberId") over LIVE rows with a number, so a
--       soft-deleted member's number may be issued again.
-- SELECT is unchanged (tenant + branch). Undo: 120_members_write_scope_down.sql.

begin;

create or replace function public.jwt_can_write_members() returns boolean
  language sql stable set search_path to 'public'
as $$
  select coalesce(auth.jwt() ->> 'user_role', '') in ('admin', 'societyAdmin', 'accountant', 'secretary', 'manager');
$$;
grant execute on function public.jwt_can_write_members() to authenticated;

-- (1) role-scoped writes (the branch-restrictive policies of 039/044 stay as they are)
drop policy if exists members_tenant_insert on public.members;
create policy members_tenant_insert on public.members for insert
  with check ((society_id in (select current_user_society_ids())) and jwt_can_write_members());

drop policy if exists members_tenant_update on public.members;
create policy members_tenant_update on public.members for update
  using ((society_id in (select current_user_society_ids())) and jwt_can_write_members())
  with check ((society_id in (select current_user_society_ids())) and jwt_can_write_members());

drop policy if exists members_tenant_delete on public.members;
create policy members_tenant_delete on public.members for delete
  using ((society_id in (select current_user_society_ids())) and jwt_can_write_members() and jwt_can_delete());

drop policy if exists "member_photos_insert" on storage.objects;
create policy "member_photos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'member-photos' and (storage.foldername(name))[1] in (select public.current_user_society_ids()) and public.jwt_can_write_members());

drop policy if exists "member_photos_update" on storage.objects;
create policy "member_photos_update" on storage.objects for update to authenticated
  using (bucket_id = 'member-photos' and (storage.foldername(name))[1] in (select public.current_user_society_ids()) and public.jwt_can_write_members())
  with check (bucket_id = 'member-photos' and (storage.foldername(name))[1] in (select public.current_user_society_ids()) and public.jwt_can_write_members());

drop policy if exists "member_photos_delete" on storage.objects;
create policy "member_photos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'member-photos' and (storage.foldername(name))[1] in (select public.current_user_society_ids()) and public.jwt_can_write_members());

-- (2) the FY audit-lock, enforced where the row is written
create or replace function public.members_fy_lock_guard() returns trigger
  language plpgsql security definer set search_path to ''
as $$
declare
  v_soc text := case when tg_op = 'DELETE' then old.society_id else new.society_id end;
begin
  -- No JWT (SQL editor) or the service role (restore / rehearsal / Edge Functions): never blocked here.
  if auth.jwt() is null or coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if exists (select 1 from public.society_settings s where s.society_id = v_soc and coalesce(s."fyLocked", false)) then
    raise exception 'members:fy_locked'
      using hint = 'वित्तीय वर्ष audit-lock है — सदस्य का बदलाव नहीं हो सकता। (Financial Year is audit-locked.)';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- A trigger function: never callable through the API (firing a trigger does not need EXECUTE).
revoke execute on function public.members_fy_lock_guard() from public, anon, authenticated;

drop trigger if exists members_fy_lock_guard on public.members;
create trigger members_fy_lock_guard
  before insert or update or delete on public.members
  for each row execute function public.members_fy_lock_guard();

-- (3) one live member number per society
create unique index if not exists members_society_memberid_live_uq
  on public.members (society_id, "memberId")
  where not coalesce("isDeleted", false) and coalesce("memberId", '') <> '';

insert into public.app_migrations (version, name) values ('120', 'members_write_scope')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (run separately; expect the noted results):
--   select policyname, cmd, coalesce(qual, with_check) from pg_policies where tablename = 'members' order by 1;
--     → members_tenant_insert/update/delete mention jwt_can_write_members()
--   select tgname from pg_trigger where tgrelid = 'public.members'::regclass and not tgisinternal;
--     → members_fy_lock_guard
--   select indexname from pg_indexes where tablename = 'members';
--     → members_society_memberid_live_uq present
