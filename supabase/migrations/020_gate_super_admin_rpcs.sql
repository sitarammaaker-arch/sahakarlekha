-- 020 · gate the three cross-tenant super-admin RPCs (audit P0-1, slice S3).
--
-- BEFORE: get_all_societies / get_society_user_counts / update_society_subscription were
-- `security definer` with NO authorization check AND a PUBLIC EXECUTE grant — any anonymous
-- caller could read every tenant's society_settings and rewrite any society's plan / is_locked.
--
-- AFTER: each function first calls is_platform_admin() (migration 019 — keyed on the caller's
-- VERIFIED JWT email) and raises 42501 for anyone who is not an active platform admin; EXECUTE
-- is revoked from public/anon and granted to authenticated only. (create-or-replace preserves the
-- existing ACL, so the REVOKE is required to actually drop the PUBLIC grant.)
--
-- PRECONDITION: deploy the S2 client first and confirm a platform admin can sign in via
-- signInWithPassword (real JWT). Only then run this — the JWT-less verify_platform_admin login
-- can no longer reach these RPCs once anon is revoked. Reversible via 020_..._down.sql.
--
-- Run once in the Supabase SQL editor.

-- ── get_all_societies() ──────────────────────────────────────────────────────
create or replace function get_all_societies()
returns table (
  id                text,
  name              text,
  registration_no   text,
  society_type      text,
  district          text,
  state             text,
  plan              text,
  trial_ends_at     date,
  plan_expires_at   date,
  is_locked         boolean,
  subscription_notes text,
  created_at        timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select
      ss.society_id, ss.name, ss."registrationNo", ss."societyType",
      ss.district, ss.state, ss.plan, ss.trial_ends_at, ss.plan_expires_at,
      ss.is_locked, ss.subscription_notes, ss.created_at
    from society_settings ss
    order by ss.created_at desc;
end;
$$;

-- ── get_society_user_counts() ────────────────────────────────────────────────
create or replace function get_society_user_counts()
returns table (society_id text, user_count bigint)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select su.society_id, count(*) as user_count
    from society_users su
    where su.is_active = true
    group by su.society_id;
end;
$$;

-- ── update_society_subscription() ────────────────────────────────────────────
create or replace function update_society_subscription(
  p_society_id        text,
  p_plan              text,
  p_plan_expires_at   timestamptz,
  p_is_locked         boolean,
  p_notes             text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update society_settings set
    plan               = p_plan,
    plan_expires_at    = p_plan_expires_at,
    is_locked          = p_is_locked,
    subscription_notes = p_notes
  where society_id = p_society_id;
end;
$$;

-- ── lock down EXECUTE (create-or-replace kept the old PUBLIC grant) ───────────
revoke execute on function get_all_societies()                                      from public, anon;
revoke execute on function get_society_user_counts()                                from public, anon;
revoke execute on function update_society_subscription(text, text, timestamptz, boolean, text) from public, anon;
grant  execute on function get_all_societies()                                      to authenticated;
grant  execute on function get_society_user_counts()                                to authenticated;
grant  execute on function update_society_subscription(text, text, timestamptz, boolean, text) to authenticated;
