-- 038 DOWN · restore the 028 role-only custom_access_token_hook (drops the user_branch_id claim).
-- Safe any time: 039's jwt_branch_ok() fails OPEN when the claim is absent, so reverting this
-- simply lifts the branch restriction as tokens refresh — no one is locked out.

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

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
