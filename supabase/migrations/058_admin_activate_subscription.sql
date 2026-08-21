-- 058 · Phase 2a-5a — platform-admin manual subscription activation.
--
-- The enabling mechanism for offline monetization: after a society pays (cheque /
-- NEFT / UPI), a platform admin activates its plan. Upserts the subscriptions row
-- with plan, status='active', a period (now + p_months), and seats_limit derived
-- from the plan. Gated by is_platform_admin() (019) — keyed on the caller's verified
-- JWT email, so it cannot be spoofed. Until a UI ships (2a-5b), an admin can call it
-- directly:  select admin_activate_subscription('SOC123', 'plus', 12);
--
-- seats_limit here MIRRORS PLAN_CATALOG.seatsLimit in src/lib/plans.ts — keep in sync.
-- Reversible via 058_admin_activate_subscription_down.sql.

create or replace function public.admin_activate_subscription(
  p_society_id text,
  p_plan       text,
  p_months     int default 12
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_seats int;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can activate a subscription';
  end if;
  if p_plan not in ('starter','plus','pro','enterprise','legacy','trial') then
    raise exception 'Unknown plan %', p_plan;
  end if;

  -- Per-plan seat cap — mirrors src/lib/plans.ts (null = unlimited: pro/enterprise/legacy).
  v_seats := case p_plan
    when 'starter' then 1
    when 'plus'    then 6
    when 'trial'   then 1
    else null
  end;

  insert into public.subscriptions
    (society_id, plan, status, period_start, period_end, seats_limit, source, activated_by, updated_at)
  values
    (p_society_id, p_plan, 'active', now(),
     case when p_plan = 'legacy' then null else now() + make_interval(months => p_months) end,
     v_seats, 'manual', lower(auth.jwt() ->> 'email'), now())
  on conflict (society_id) do update set
    plan         = excluded.plan,
    status       = excluded.status,
    period_start = excluded.period_start,
    period_end   = excluded.period_end,
    seats_limit  = excluded.seats_limit,
    source       = excluded.source,
    activated_by = excluded.activated_by,
    updated_at   = now();
end;
$$;

revoke all on function public.admin_activate_subscription(text, text, int) from public, anon;
grant execute on function public.admin_activate_subscription(text, text, int) to authenticated;
