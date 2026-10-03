-- 099 · record the TDS catalog version whose rules were matched against the Income-tax Act 2025 text
--       (2026-10-03, incometaxindia.gov.in s.393 + s.402 pages).
--
-- What changed in src/lib/rules/tax.ts (values from buildCatalogVersion, pinned by test:catalog-version):
--   • tds.194q.applies_if.buyer_turnover_min → VERIFIED (s.402(6) Table Sl. No. 1, "buyer": preceding-year
--     turnover exceeding ten crore rupees). Recorded, still not enforced.
--   • tds.194{h,c,j,i}.charge_on_excess_only = 0 — tax on the ENTIRE sum once the threshold is crossed,
--     s.393(1)(a). computeTds now computes these instead of refusing.
--   • tds.194q.base_excludes_gst_when_separate_and_on_credit — CBDT Circular 13/2021 para 4.3.2 (via 20/2021
--     para 5.2.1); UNVERIFIED for the 2025 Act.
--   • tds.194a.* → UNVERIFIED: ₹50,000 is the banking payers' row (5(ii)); a non-banking society is 5(iii)
--     (₹10,000) and s.393(4) Sl. 7(b) exempts interest it pays members; the rate is "Rates in force".
-- Append-only audit row (catalog_versions, 053), idempotent. Undo: 099_tds_catalog_sourced_down.sql.

begin;

insert into catalog_versions (catalog_name, content_hash, rule_count, value_count, verified_count, unverified_count, source)
values ('tds', '98270a8826d27783', 22, 26, 21, 5, 'bundle')
on conflict (catalog_name, content_hash) do nothing;

insert into public.app_migrations (version, name) values ('099', 'tds_catalog_sourced')
  on conflict (version) do nothing;

commit;
