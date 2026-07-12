-- ============================================================================
-- P1-SEC-4 · B — drop the retired app_login RPC
-- ============================================================================
-- app_login was the legacy JWT-less login fallback: a SECURITY DEFINER function
-- that verified a PLAIN-TEXT password against society_users.password server-side.
-- It never established a Supabase Auth session, so under tenant RLS (P1-SEC-1b) it
-- could not complete a usable login; W-1 had already turned it into a dead-end and
-- PR #60 (P1-SEC-4 · A) removed its last caller from the client. Every active user
-- is on Supabase Auth (jwt_less_legacy = 0), so nothing depends on it.
--
-- Dropping it removes an anon-callable password-verification endpoint (credential
-- stuffing / user-enumeration / timing surface). Rollback: 010_..._down.sql
-- recreates it verbatim (also see supabase-app-login.sql).
--
-- NOTE: this does NOT touch society_users.password (still plain-text at rest for
-- 20 users) — that data remediation + write-path cleanup is the next item.
-- ============================================================================

begin;

drop function if exists public.app_login(text, text);

commit;
