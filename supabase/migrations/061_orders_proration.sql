-- 061 · Phase B (proration) — record what each order does to the subscription.
--
-- create-order now computes the amount AND the resulting period_end server-side
-- (upgrade = prorated difference for the remaining period, same renewal date;
-- renew = full price, extend; new = full price, now+12mo). We store the decision on
-- the order so razorpay-webhook just APPLIES it (single source, no recompute at
-- payment time). Reversible via _down.

alter table orders add column if not exists kind text not null default 'new'
  check (kind in ('new','renew','upgrade'));
alter table orders add column if not exists set_period_end timestamptz;
