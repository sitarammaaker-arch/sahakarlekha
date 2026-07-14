-- 038 · custom_access_token_hook v2 — ALSO put society_users.branch_id into the JWT as a signed
--       `user_branch_id` claim (ECR-17 server-side branch enforcement, prerequisite for 039).
--
-- Extends the PROVEN 028 hook (already enabled in Dashboard → Authentication → Hooks). Because the
-- hook is `create or replace`d in place, NO dashboard change is needed — new tokens pick this up on
-- the next login / refresh automatically. Same FAIL-SAFE shape as 028: any lookup error is swallowed
-- and the claims pass through unchanged, so token issuance can never be blocked.
--
-- Semantics (must mirror the client's src/lib/branchScope.ts):
--   * branch_id and role come from the SAME society_users row (admin-preferred, same ORDER BY as
--     028) — never from two different rows.
--   * branch_id set     → user is branch-restricted; 039's policies scope their SELECTs.
--   * branch_id NULL/'' → no claim emitted → unrestricted (society-wide), nothing changes.
--   * No claim is also the state of: old tokens issued before this runs, the JWT-less platform-admin
--     path, and anon — 039 fails OPEN on a missing claim, so none of those can be locked out.
--
-- ROLLOUT:
--   1. Run this file in the Supabase SQL Editor (the hook is replaced atomically).
--   2. In a fresh incognito window, log in as a branch-restricted user; decode the access token
--      (jwt.io) and confirm it carries BOTH `user_role` and `user_branch_id`.
--   3. Log in as an unrestricted admin; confirm `user_branch_id` is ABSENT.
--   4. If anything is off, run 038_jwt_branch_claim_down.sql (restores the 028 role-only hook).
-- NOTE: a branch (re)assignment in User Management reaches the JWT only on the next token
-- issuance — i.e. within the access-token TTL (~1h) or at next login.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer            -- runs as owner, so it can read society_users regardless of RLS
set search_path = public
as $$
declare
  claims jsonb;
  em text;
  r text;
  b text;
begin
  claims := coalesce(event -> 'claims', '{}'::jsonb);
  begin
    em := lower(nullif(event #>> '{claims,email}', ''));
    if em is not null then
      select role, branch_id into r, b
        from public.society_users
       where lower(email) = em and is_active = true
       order by (role = 'admin') desc          -- prefer admin if a user has multiple rows
       limit 1;
      if r is not null then
        claims := jsonb_set(claims, '{user_role}', to_jsonb(r));
      end if;
      if nullif(b, '') is not null then
        claims := jsonb_set(claims, '{user_branch_id}', to_jsonb(b));
      end if;
    end if;
  exception when others then
    null;   -- NEVER block token issuance — swallow any error and fall through
  end;
  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Grants unchanged from 028 (re-asserted for idempotence).
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
