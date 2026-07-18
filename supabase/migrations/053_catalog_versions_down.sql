-- 053 down · drop the catalog_versions audit trail. Reversible: it is additive reference
-- metadata, read by nothing at runtime (the engine reads the bundle), so dropping it changes
-- no figure and no statement — it only discards the recorded version history.

drop policy if exists "catalog_versions_select" on catalog_versions;
drop index if exists catalog_versions_name_time_idx;
drop table if exists catalog_versions;
