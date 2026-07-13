-- 020 down · restore the ORIGINAL ungated super-admin RPCs + PUBLIC EXECUTE.
-- ⚠️ This re-opens the P0-1 hole (anon can read all tenants / rewrite any plan). Use only to
-- roll back if the gated versions break the SuperAdmin dashboard (e.g. admins can't get a JWT).

create or replace function get_all_societies()
returns table (
  id text, name text, registration_no text, society_type text, district text, state text,
  plan text, trial_ends_at date, plan_expires_at date, is_locked boolean,
  subscription_notes text, created_at timestamptz
)
language sql security definer set search_path = public, extensions
as $$
  select ss.society_id, ss.name, ss."registrationNo", ss."societyType",
         ss.district, ss.state, ss.plan, ss.trial_ends_at, ss.plan_expires_at,
         ss.is_locked, ss.subscription_notes, ss.created_at
  from society_settings ss order by ss.created_at desc;
$$;

create or replace function get_society_user_counts()
returns table (society_id text, user_count bigint)
language sql security definer set search_path = public, extensions
as $$
  select society_id, count(*) as user_count
  from society_users where is_active = true group by society_id;
$$;

create or replace function update_society_subscription(
  p_society_id text, p_plan text, p_plan_expires_at timestamptz, p_is_locked boolean, p_notes text
)
returns void
language sql security definer set search_path = public, extensions
as $$
  update society_settings set
    plan = p_plan, plan_expires_at = p_plan_expires_at,
    is_locked = p_is_locked, subscription_notes = p_notes
  where society_id = p_society_id;
$$;

grant execute on function get_all_societies()                                      to public;
grant execute on function get_society_user_counts()                                to public;
grant execute on function update_society_subscription(text, text, timestamptz, boolean, text) to public;
