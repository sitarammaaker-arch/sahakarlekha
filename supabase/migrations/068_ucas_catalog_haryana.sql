-- 068 · record the UCAS catalog version that adds Haryana's statutory appropriation figures.
--
-- The UCAS rules (src/lib/rules/ucas.ts) now carry Haryana ('hr') values read from the TEXT of the
-- Haryana Co-operative Societies Act 1984 (s.87(1)(a)) and Rules 1989 (rr.72-74), each cited and
-- marked verified, plus a new rule bad_debt_fund_min_pct. The engine reads the bundle; this row is
-- the audit trail (catalog_versions, 053) that says which catalog content was in force from now.
-- Append-only, idempotent. Pinned by test:catalog-version. Run once in the Supabase SQL editor.

insert into catalog_versions (catalog_name, content_hash, rule_count, value_count, verified_count, unverified_count, source)
values ('ucas', 'd0e62014e64728ca', 5, 8, 4, 0, 'bundle')
on conflict (catalog_name, content_hash) do nothing;

-- Verify (expect 2 rows for ucas: the 053 seed and this one, newest first):
--   select catalog_name, content_hash, rule_count, value_count, verified_count, recorded_at
--   from catalog_versions where catalog_name = 'ucas' order by recorded_at desc;
