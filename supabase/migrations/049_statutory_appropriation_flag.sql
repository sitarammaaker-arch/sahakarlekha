-- 049 · T-20 (UCAS CM-1) — the per-tenant statutory-appropriation flag.
--
-- society_settings.statutoryAppropriation turns ON canonical year-end appropriation posting for ONE
-- society at a time. While false (the default) the society appropriates net surplus exactly as today,
-- through the legacy ad-hoc ReserveFund / ProfitDistribution float path. When true, the app may post
-- the appropriation as ONE balanced voucher through the CANONICAL engine — effective-dated UCAS rates
-- (Reserve ≥25%, Education 5%, dividend ≤15% of share capital), exact paise, caps enforced, refused
-- if invalid — and it rides the ledger like any other voucher.
--
-- ADDITIVE + DORMANT: defaults to false, so running this migration changes NOTHING. Flipped per tenant,
-- deliberately; the legacy path is retired only after the canonical posting has soaked. Reversible via
-- _down. Byte-for-byte identical to the DDL in supabase-tables.sql (idempotent).

alter table society_settings add column if not exists "statutoryAppropriation" boolean default false;
