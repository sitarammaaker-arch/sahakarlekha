-- 055 · Phase 2a-1 — subscriptions table (per-society billing state) + legacy backfill.
--
-- One row per society. plan/limits/period drive feature-gating (2a-2, via
-- society_capabilities) and numeric caps (2a-3, users/societies). This row is
-- ENTITLEMENT-bearing: a client may READ its own society's row (tenant RLS) but
-- NEVER write it — only service-role / SECURITY DEFINER RPCs (billing webhook,
-- admin activation) write. Existing societies are grandfathered to plan='legacy'
-- (indefinite, free) so nothing breaks and no one is auto-charged.
--
-- ADDITIVE: no code reads this table until 2a-2, so running it changes NOTHING
-- for current users. Reversible via 055_subscriptions_down.sql (safe drop).

create table if not exists subscriptions (
  society_id   text primary key,
  plan         text not null default 'legacy'
                 check (plan in ('starter','plus','pro','enterprise','legacy','trial')),
  status       text not null default 'active'
                 check (status in ('active','trialing','grace','expired')),
  period_start timestamptz,
  period_end   timestamptz,            -- null = indefinite (legacy)
  seats_limit  integer,                -- null = unlimited (pro / enterprise / legacy)
  source       text not null default 'manual'
                 check (source in ('manual','razorpay','grandfather','trial','system')),
  activated_by text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table subscriptions enable row level security;

-- Read-own-society only. No INSERT/UPDATE/DELETE policy → client writes are denied;
-- service_role and SECURITY DEFINER RPCs bypass RLS and are the only writers.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'subscriptions' and policyname = 'subscriptions_select_own'
  ) then
    create policy "subscriptions_select_own" on subscriptions
      for select using (society_id = get_current_society_id());
  end if;
end $$;

create index if not exists idx_subscriptions_status on subscriptions(status);

-- Grandfather every existing society: indefinite free 'legacy'. Idempotent; safe to
-- re-run. New societies get their row from the signup/trial path in a later slice.
insert into subscriptions (society_id, plan, status, period_end, seats_limit, source, notes)
select id, 'legacy', 'active', null, null, 'grandfather', 'auto-grandfathered existing society'
from societies
on conflict (society_id) do nothing;
