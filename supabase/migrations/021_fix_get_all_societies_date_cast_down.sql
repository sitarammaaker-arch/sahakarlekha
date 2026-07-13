-- 021 down · revert to the un-cast (buggy) plpgsql body from migration 020.
-- Only meaningful if you are rolling back 021 specifically; the RPC will 42804 again at RETURN QUERY.
create or replace function get_all_societies()
returns table (
  id text, name text, registration_no text, society_type text, district text, state text,
  plan text, trial_ends_at date, plan_expires_at date, is_locked boolean,
  subscription_notes text, created_at timestamptz
)
language plpgsql security definer set search_path = public, extensions
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

create or replace function get_society_user_counts()
returns table (society_id text, user_count bigint)
language plpgsql security definer set search_path = public, extensions
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
