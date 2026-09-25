-- Rollback for 064_member_portal.sql — removes the member-portal RPC and link table.
-- The auth.users rows created for members (S2) are NOT deleted here; remove them from
-- Authentication → Users (email domain @m.sahakarlekha.com) if the portal is being retired.
begin;
drop function if exists public.member_portal_snapshot();
drop table if exists public.member_portal_users;
commit;
