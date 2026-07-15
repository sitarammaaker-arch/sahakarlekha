-- 040 · T-09 (ADR-0001) — make ledger reads the DEFAULT (auto-cutover).
--
-- The pilot (57582974-…) has soaked with all reports served from the event journal and parity ✓.
-- This flips the remaining tenants and makes every NEW society ledger-authoritative from birth.
--
-- SAFE BY DESIGN — this does NOT trust the flag blindly. Every ledger read (getTrialBalance and the
-- four report gates) is guarded at runtime by ledgerParity / per-report parity: a society whose
-- journal does not reproduce its vouchers EXACTLY silently keeps computing from voucher state, as
-- today. So flipping a tenant whose journal is short/stale changes nothing until its journal is
-- faithful — the flag only ever ENABLES the ledger path, never forces a wrong number.
--
-- Prereq already done: genesis + opening events seeded and 13/13 parity ✓ (2026-07-15); live-path
-- account mutations now append opening-delta events (planOpeningDelta), so new openings stay faithful
-- without any re-seed. Reversible via _down (restores default false; existing true flags are left as
-- they were the intent).

-- 1. New societies default to ledger reads.
alter table society_settings alter column "ledgerReadsEnabled" set default true;

-- 2. Flip every existing society. NULL (never set) and false both become true; the runtime parity
--    gate protects any tenant not yet fully faithful.
update society_settings set "ledgerReadsEnabled" = true
where "ledgerReadsEnabled" is distinct from true;
