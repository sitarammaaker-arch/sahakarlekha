-- 022 down · STRUCTURAL rollback only. Re-adds the plaintext column + the verify_platform_admin RPC
-- shell. ⚠️ The original plaintext passwords are GONE and cannot be restored — every row's password is
-- NULL, so this function authenticates no one until passwords are re-populated. Provided for schema
-- symmetry; you would not normally roll back this security cleanup.

alter table platform_admins add column if not exists password text;

create or replace function verify_platform_admin(p_email text, p_password text)
returns table (email text, name text)
language sql
security definer
set search_path = public, extensions
as $$
  select email, name from platform_admins
  where email = p_email and password = p_password and is_active = true;
$$;
