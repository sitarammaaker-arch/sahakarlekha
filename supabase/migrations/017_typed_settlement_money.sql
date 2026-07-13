-- 017 · Typed money columns for procurement_settlements (T-05 — promote money-material JSONB
-- → typed, constrained columns; IRR-7).
--
-- gross / netPayable / amountPaid are stored as `{ amount, currency }` JSONB money objects.
-- This promotes each to a typed pair: `<field>AmountMinor` (integer paise, CL-3) + a currency
-- text column. The JSONB is RETAINED — the client now DUAL-WRITES both, and still reads the
-- JSONB (dual-read cutover is a later slice), so this changes nothing the app displays. It just
-- ensures the money no longer lives ONLY in unconstrained JSONB.
--
-- Run once in the Supabase SQL editor after deploying the T-05 client change (the dual-write
-- also depends on these columns existing; until then the step-2 write logs a mild warning and
-- the base row is unaffected).

alter table procurement_settlements add column if not exists "grossAmountMinor"      bigint;
alter table procurement_settlements add column if not exists "grossCurrency"         text;
alter table procurement_settlements add column if not exists "netPayableAmountMinor" bigint;
alter table procurement_settlements add column if not exists "netPayableCurrency"    text;
alter table procurement_settlements add column if not exists "amountPaidAmountMinor" bigint;
alter table procurement_settlements add column if not exists "amountPaidCurrency"    text;

-- Backfill from the JSONB money objects (amount is rupees → ×100 paise). Idempotent: coalesce
-- only fills a NULL typed column, never overwrites an already-populated one.
update procurement_settlements set
  "grossAmountMinor"      = coalesce("grossAmountMinor",      (round(((gross->>'amount')::numeric)        * 100))::bigint),
  "grossCurrency"         = coalesce("grossCurrency",         coalesce(gross->>'currency', 'INR')),
  "netPayableAmountMinor" = coalesce("netPayableAmountMinor", (round((("netPayable"->>'amount')::numeric)  * 100))::bigint),
  "netPayableCurrency"    = coalesce("netPayableCurrency",    coalesce("netPayable"->>'currency', 'INR')),
  "amountPaidAmountMinor" = coalesce("amountPaidAmountMinor", (round((("amountPaid"->>'amount')::numeric)  * 100))::bigint),
  "amountPaidCurrency"    = coalesce("amountPaidCurrency",    coalesce("amountPaid"->>'currency', 'INR'))
where gross is not null or "netPayable" is not null or "amountPaid" is not null;
