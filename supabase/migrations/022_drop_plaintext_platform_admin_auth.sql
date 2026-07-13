-- 022 · retire the JWT-less plaintext platform-admin auth (audit P0-1/P0-3, slice S4 — final).
--
-- After S2/S3, platform admins sign in only via Supabase Auth (signInWithPassword → JWT) and the
-- three cross-tenant RPCs gate on is_platform_admin(). The old login path is fully dead:
--   • verify_platform_admin(text, text) — a SECURITY DEFINER RPC that compared a PLAINTEXT password
--     and minted no JWT. No longer called from the client (removed in S3).
--   • platform_admins.password — the plaintext password column it read.
-- This migration drops both. The admin credential now lives only in auth.users (bcrypt), so no login
-- capability is lost.
--
-- ⚠️ IRREVERSIBLE: dropping the column destroys the plaintext passwords. Ensure every platform admin
-- can sign in via Supabase Auth BEFORE running this (S2/S3 already verified for the sole admin).
-- Run once in the Supabase SQL editor.

-- Drop the function first (it references the column).
drop function if exists verify_platform_admin(text, text);

-- Then drop the plaintext column.
alter table platform_admins drop column if exists password;
