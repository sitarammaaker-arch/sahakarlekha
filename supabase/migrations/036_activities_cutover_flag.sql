-- 036 · T-12 (ADR-0003, MR-1) — the per-tenant Activities-layer cutover flag.
--
-- society_settings.activitiesCutoverEnabled turns ON activity-driven capability resolution for ONE
-- society at a time. While false (the default) the society resolves capabilities from its TYPE
-- template exactly as today. When true, the resolver gates capabilities on the society's declared
-- activities WITHIN entitlement — but only ever after the app's hasCutoverParity() guard confirms
-- the switch loses no module (MR-1: no society loses a visible module at cutover). If parity does
-- not hold the app falls back to type-template resolution, so an over-eager flip can never hide a
-- module.
--
-- ADDITIVE + DORMANT: defaults to false, so running this migration changes NOTHING. The flag is
-- flipped per tenant, deliberately, AFTER society_activities has been backfilled with an empty-diff
-- inference (a later step). Reversible via _down (drops the column). Byte-for-byte identical to the
-- DDL already in supabase-tables.sql (idempotent).

alter table society_settings add column if not exists "activitiesCutoverEnabled" boolean default false;
