-- ============================================================================
-- Item #4 · schema-drift reconciliation — drop the stale update_society_subscription overload
-- ============================================================================
-- Production carries TWO update_society_subscription functions (schema drift):
--   #1  (text, text, DATE, boolean, text)  param p_subscription_notes   ← stale
--   #2  (text, text, TIMESTAMPTZ, boolean, text)  param p_notes          ← the real one
-- The repo (supabase-tables.sql) only ever defined #2, and society_settings
-- .plan_expires_at is timestamptz, so #2 is correct. The client (SuperAdminDashboard
-- handleSave) sends `p_notes` + an ISO timestamp, so PostgREST resolves to #2 by
-- name; #1 has a different param name (p_subscription_notes) and is never called.
--
-- Dropping the dead #1 removes the drift + any latent overload-resolution ambiguity.
-- No client/behaviour change. Rollback: 013_..._down.sql recreates #1 verbatim.
-- ============================================================================

begin;

drop function if exists public.update_society_subscription(text, text, date, boolean, text);

commit;
