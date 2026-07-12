-- ============================================================================
-- P1-SEC-1a · ROLLBACK — drop register_society
-- ============================================================================
-- Reverses 006_register_society_rpc.sql. Safe to run any time: the pre-existing
-- app_register_admin RPC and the permissive INSERT policies on societies /
-- society_settings / accounts are untouched by 006, so dropping register_society
-- returns registration to its prior state — PROVIDED src/pages/Register.tsx has
-- also been reverted to the direct-insert flow (git revert the paired commit).
--
-- Order of rollback: revert Register.tsx FIRST (so the client stops calling the
-- RPC), then run this. Running this while the client still calls register_society
-- would make signup fail with "function does not exist".
-- ============================================================================

drop function if exists public.register_society(text, text, text, text, jsonb, jsonb, jsonb);
