-- 093 · record the TDS catalog version that adds tds.194q.charge_on_excess_only (Phase-2 D).
--
-- "On the excess only vs on the whole sum" became a sourced, per-section rule (194Q: s.393(1) Sl. 8(ii)
-- Note 1(b), "The tax shall be deducted on the sum exceeding fifty lakh rupees"). computeTds now refuses
-- above the threshold for a section without that rule instead of assuming "excess only" everywhere.
-- This appends the new catalog content to the audit trail (catalog_versions, 053) — values from
-- buildCatalogVersion, pinned by test:catalog-version. Append-only, idempotent.
-- Undo: 093_tds_catalog_charge_basis_down.sql.

begin;

insert into catalog_versions (catalog_name, content_hash, rule_count, value_count, verified_count, unverified_count, source)
values ('tds', '1cef8d5dc06e5e38', 17, 21, 19, 2, 'bundle')
on conflict (catalog_name, content_hash) do nothing;

insert into public.app_migrations (version, name) values ('093', 'tds_catalog_charge_basis')
  on conflict (version) do nothing;

commit;
