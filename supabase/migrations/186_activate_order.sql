-- 186 · SEC-07 (product audit 2026-11-17) — a paid order always activates its plan, in one transaction
--
-- Before: razorpay-webhook marked the order 'paid', then upserted the subscription, reading NEITHER result. If the second
--   write failed (network, constraint, a timeout), the order stayed 'paid' with no plan, and Razorpay's retry was answered
--   "already processed" — the society paid and stayed on its old plan, with nothing left to fix it but a human.
-- After: public.activate_order() does both writes in ONE transaction, under a row lock on the order:
--   • it checks the captured amount against the order's own amount_paise (migration 158) — a mismatch activates nothing
--     and is reported ('amount_mismatch');
--   • it stamps orders.activated_at; a retry of an activated order answers 'already' (safe to call any number of times),
--     while an order that was marked paid but never activated (the old failure) is activated on the next call;
--   • period_end comes from the order (set_period_end, decided in create-order) or now + 12 months; seats mirror
--     src/lib/plans.ts PLAN_CATALOG (starter 1, plus 6, pro / others unlimited).
--   Only the service role may call it (the webhook); no browser can.
-- Production 2026-11-19: 6 paid orders (all test payments, Aug 2026) — every society's live subscription came from its
--   latest one, so the backfill below marks all six activated and changes no subscription.
-- Undo: 186_activate_order_down.sql.

begin;

alter table public.orders add column if not exists activated_at timestamptz;
update public.orders set activated_at = coalesce(updated_at, created_at) where status = 'paid' and activated_at is null;

create or replace function public.activate_order(p_order_id text, p_payment_id text, p_amount_paise bigint default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o       public.orders;
  v_now   timestamptz := now();
  v_end   timestamptz;
  v_seats int;
begin
  if coalesce(p_order_id, '') = '' then return jsonb_build_object('status', 'unknown_order'); end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then return jsonb_build_object('status', 'unknown_order'); end if;
  if o.activated_at is not null then
    return jsonb_build_object('status', 'already', 'society_id', o.society_id, 'plan', o.plan);
  end if;
  -- Another captured payment already settled this order (a duplicate capture): never activate twice.
  if o.status = 'paid' and o.payment_id is not null and coalesce(p_payment_id, '') <> '' and o.payment_id <> p_payment_id then
    return jsonb_build_object('status', 'different_payment', 'society_id', o.society_id);
  end if;
  -- The money captured must be what this order asked for (amount_paise is set in create-order, migration 158).
  if p_amount_paise is not null and o.amount_paise is not null and p_amount_paise <> o.amount_paise then
    return jsonb_build_object('status', 'amount_mismatch', 'society_id', o.society_id, 'expected', o.amount_paise, 'got', p_amount_paise);
  end if;

  v_end   := coalesce(o.set_period_end, v_now + interval '12 months');
  v_seats := case o.plan when 'starter' then 1 when 'plus' then 6 else null end;   -- = PLAN_CATALOG seatsLimit

  update public.orders
     set status = 'paid', payment_id = coalesce(nullif(p_payment_id, ''), payment_id), activated_at = v_now, updated_at = v_now
   where id = o.id;

  insert into public.subscriptions (society_id, plan, status, period_start, period_end, seats_limit, source, activated_by, updated_at)
  values (o.society_id, o.plan, 'active', v_now, v_end, v_seats, 'razorpay', 'razorpay:' || coalesce(nullif(p_payment_id, ''), o.payment_id, o.id), v_now)
  on conflict (society_id) do update
     set plan = excluded.plan, status = 'active', period_start = excluded.period_start, period_end = excluded.period_end,
         seats_limit = excluded.seats_limit, source = excluded.source, activated_by = excluded.activated_by, updated_at = excluded.updated_at;

  return jsonb_build_object('status', 'activated', 'society_id', o.society_id, 'plan', o.plan, 'period_end', v_end);
end
$$;
revoke execute on function public.activate_order(text, text, bigint) from public, anon, authenticated;
grant execute on function public.activate_order(text, text, bigint) to service_role;

insert into public.app_migrations (version, name) values ('186', 'activate_order')
  on conflict (version) do nothing;

commit;

-- VERIFY (read-only):
--   select to_regprocedure('public.activate_order(text,text,bigint)') is not null;                          -- true
--   select count(*) from public.orders where status = 'paid' and activated_at is null;                      -- 0
--   select has_function_privilege('authenticated', 'public.activate_order(text,text,bigint)', 'execute');   -- false
