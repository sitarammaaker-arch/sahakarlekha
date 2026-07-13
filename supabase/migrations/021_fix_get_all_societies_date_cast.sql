-- 021 · hotfix get_all_societies() — cast timestamptz columns to date (audit P0-1 followup).
--
-- Migration 020 rewrote get_all_societies() from `language sql` to `language plpgsql`. The RETURNS
-- TABLE signature declares trial_ends_at / plan_expires_at as `date`, but the actual society_settings
-- columns are `timestamptz`. The old `language sql` body tolerated this via an implicit assignment
-- cast; plpgsql's `RETURN QUERY` is strict and raised:
--   42804: structure of query does not match function result type
--   DETAIL: Returned type timestamp with time zone does not match expected type date in column 8.
-- so the SuperAdmin dashboard showed "No societies found" (the RPC errored). Fix = cast the two
-- columns to ::date in the query (return signature unchanged, so no 42P13 return-type change).
--
-- Run once in the Supabase SQL editor (safe to re-run).

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
      ss.district, ss.state, ss.plan,
      ss.trial_ends_at::date, ss.plan_expires_at::date,
      ss.is_locked, ss.subscription_notes, ss.created_at
    from society_settings ss
    order by ss.created_at desc;
end;
$$;

-- Same class of bug in get_society_user_counts(): society_users.society_id is `uuid` but the
-- RETURNS TABLE declares `society_id text`. The old `language sql` body cast implicitly; plpgsql
-- RETURN QUERY raised 42804 (uuid vs text in column 1), so every society showed 0 users. Cast ::text.
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
    select su.society_id::text, count(*) as user_count
    from society_users su
    where su.is_active = true
    group by su.society_id;
end;
$$;
