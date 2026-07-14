-- 037 · T-09 (ADR-0001) — the per-tenant ledger read-cut flag.
--
-- society_settings.ledgerReadsEnabled turns ON ledger-sourced financial reads for ONE society at a
-- time. While false (the default) getTrialBalance is computed from voucher state exactly as today.
-- When true, the app serves getTrialBalance from the event journal — but ONLY when ledgerParity()
-- confirms the journal reproduces the vouchers at that moment; otherwise it falls back to the
-- voucher-state compute. So an over-eager flip (or a journal not yet fully loaded/seeded) can never
-- break a report.
--
-- ADDITIVE + DORMANT: defaults to false, so running this migration changes NOTHING. Flipped per tenant,
-- deliberately, only AFTER the tenant's journal is loaded and parity shows ✓. Reversible via _down.
-- Byte-for-byte identical to the DDL already in supabase-tables.sql (idempotent).

alter table society_settings add column if not exists "ledgerReadsEnabled" boolean default false;
