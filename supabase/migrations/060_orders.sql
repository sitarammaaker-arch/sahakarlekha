-- 060 · Phase 2b-1 — payment orders (Razorpay).
--
-- One row per Razorpay order created at checkout. Written ONLY by server code
-- (create-order / webhook, service-role); a society may READ its own orders. The
-- webhook flips status to 'paid' and then activates the subscription — the order
-- row is the audit trail of what was paid for. Reversible via _down.

create table if not exists orders (
  id         text primary key,               -- razorpay order id (order_...)
  society_id text not null,
  plan       text not null,                  -- starter | plus | pro
  amount     integer not null,               -- rupees (₹), whole
  currency   text not null default 'INR',
  status     text not null default 'created'
               check (status in ('created','paid','failed')),
  payment_id text,                           -- razorpay payment id once captured
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table orders enable row level security;

-- Read-own-society only; no client write policy → server (service-role) writes only.
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'orders' and policyname = 'orders_select_own'
  ) then
    create policy "orders_select_own" on orders
      for select using (society_id = get_current_society_id());
  end if;
end $$;

create index if not exists idx_orders_society on orders(society_id);
