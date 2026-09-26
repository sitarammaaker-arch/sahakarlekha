-- 068 down · remove the catalog_versions row 068 recorded (the 053 seed stays).
-- Only needed if the ucas.ts change itself is reverted; the audit table is otherwise append-only.
delete from catalog_versions where catalog_name = 'ucas' and content_hash = 'd0e62014e64728ca';
