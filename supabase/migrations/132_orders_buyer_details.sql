-- 132 · orders.buyer_* — the buyer details the society confirms at checkout (2026-10-20, billing slice 2b).
--
-- WHAT: name / GSTIN / state code / address for the tax invoice, entered in the checkout dialog and
--   validated by create-order (GSTIN format, its first two digits = the chosen state, a real GST state code).
--   The invoice issuer (_shared/issue-invoice.mjs) prefers these over society_settings — society_settings
--   has no GSTIN column in prod, and its state is a Setup value ('hr'), so it is only the fallback.
--   create-order writes these in a SECOND step after the base insert, so a checkout still works (and the
--   invoice falls back to society_settings) if this migration has not run yet.
-- Additive. Undo: 132_orders_buyer_details_down.sql.

begin;

alter table public.orders add column if not exists buyer_name text;
alter table public.orders add column if not exists buyer_gstin text
  check (buyer_gstin is null or buyer_gstin ~ '^[0-3][0-9][A-Z0-9]{13}$');
alter table public.orders add column if not exists buyer_state_code text
  check (buyer_state_code is null or buyer_state_code ~ '^[0-3][0-9]$');
alter table public.orders add column if not exists buyer_address text;

insert into public.app_migrations (version, name) values ('132', 'orders_buyer_details')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: cols = 4 | mig = 1):
--   select (select count(*) from information_schema.columns where table_name = 'orders'
--             and column_name in ('buyer_name', 'buyer_gstin', 'buyer_state_code', 'buyer_address')) as cols,
--          (select count(*) from public.app_migrations where version = '132') as mig;
