-- 019 down · drop the is_platform_admin() predicate.
-- Safe only when no client build / RPC gate (slice S3) depends on it.
drop function if exists is_platform_admin();
