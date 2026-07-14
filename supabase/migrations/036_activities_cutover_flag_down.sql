-- 036 down · T-12 — remove the per-tenant Activities-layer cutover flag.
-- Safe: the column defaults false and no financial data depends on it; dropping it reverts every
-- society to type-template capability resolution (today's behaviour).
alter table society_settings drop column if exists "activitiesCutoverEnabled";
