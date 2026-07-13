-- 028 · custom_access_token_hook — put society_users.role into the JWT as a signed claim
--       (audit P0-3, Layer B / SB1). Prerequisite for role-scoped mutation RLS (SB2).
--
-- ⚠️ HIGHEST-RISK CHANGE IN THE AUDIT. A custom access token hook runs on EVERY token issuance; if it
-- errors or returns a bad shape, EVERY login fails. This function is written FAIL-SAFE (wrapped in an
-- exception handler that swallows everything and returns the claims unchanged) so a lookup problem
-- can never block login — the only residual risks are a wrong grant or the Dashboard pointing at the
-- wrong function. ROLLBACK is always available and instant: Dashboard → Authentication → Hooks →
-- un-select the hook (the Supabase dashboard is independent of app login, so this works even if app
-- logins break).
--
-- ROLLOUT (do NOT skip the verify):
--   1. Run this file (creates the function + grants — HARMLESS on its own; nothing calls it yet).
--   2. Dashboard → Authentication → Hooks → "Customize Access Token (JWT) Claims" → select
--      public.custom_access_token_hook.
--   3. IMMEDIATELY, in a fresh incognito window, log in and confirm login works. Decode the access
--      token (jwt.io) and confirm it carries `user_role`. Keep the Supabase dashboard tab open.
--   4. If anything is off, un-select the hook (step 2) — logins recover at once.
-- SB1 only ADDS a claim; it changes NO access until SB2 role-scopes the mutation policies.

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
begin
  claims := coalesce(event -> 'claims', '{}'::jsonb);
  begin
    em := lower(nullif(event #>> '{claims,email}', ''));
    if em is not null then
      select role into r
        from public.society_users
       where lower(email) = em and is_active = true
       order by (role = 'admin') desc          -- prefer admin if a user has multiple rows
       limit 1;
      if r is not null then
        claims := jsonb_set(claims, '{user_role}', to_jsonb(r));
      end if;
    end if;
  exception when others then
    null;   -- NEVER block token issuance — swallow any error and fall through
  end;
  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- GoTrue runs the hook as supabase_auth_admin; it must be able to reach + execute the function.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
-- No one else may call it.
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
