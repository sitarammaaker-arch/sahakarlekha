-- 050 · T-23 (UCAS CM-2 / CL-7) — governance authority for the FY close.
--
-- Locking the financial year is a FINALIZATION: its legality derives from a recorded board
-- resolution. society_settings.fyCloseAuthorityRequired turns that requirement ON for ONE society
-- at a time. While false (the default) the year locks exactly as today, with no recorded authority.
-- When true, the close is refused unless a valid board resolution is attested (correct authority
-- kind, reference, date, authorizer, and SoD — the authorizer must not be the admin locking).
--
-- fyCloseAuthority stores the act that authorized the close, stamped at lock time, e.g.
--   "board_resolution BR/2025-26/12 (2026-04-15) — Board of Directors"
-- the audit link from the locked year to the resolution that closed it.
--
-- ADDITIVE + DORMANT: defaults to false, so running this migration changes NOTHING. Flipped per
-- tenant. Reversible via _down. Byte-for-byte identical to the DDL in supabase-tables.sql.

alter table society_settings add column if not exists "fyCloseAuthorityRequired" boolean default false;
alter table society_settings add column if not exists "fyCloseAuthority" text;
