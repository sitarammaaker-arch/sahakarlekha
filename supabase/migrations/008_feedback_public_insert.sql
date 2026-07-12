-- ============================================================================
-- P1-SEC-2 · feedback = PUBLIC inbox, NOT a tenant table — restore public INSERT
-- ============================================================================
-- 007 discovers tenant tables by their `society_id` column, so it swept in
-- `feedback` too: it dropped the original `feedback_insert` (WITH CHECK true) and
-- added feedback_tenant_insert / feedback_tenant_delete. But `feedback` is the
-- marketing-site PUBLIC inbox — ContactUs, FeedbackFab, HelpfulWidget,
-- RatingWidget and review submissions all insert into it, most from ANONYMOUS
-- (no-JWT) visitors. Under the tenant policy their INSERT checks
-- society_id::text = get_current_society_id() = NULL → DENIED, silently breaking
-- every public submission the moment 007 was applied.
--
-- This restores feedback's intended model (identical to 002_feedback.sql):
--   • INSERT  : anyone (WITH CHECK true). Client inserts WITHOUT .select(), so no
--               row is read back and nothing leaks.
--   • SELECT  : platform admins only  (feedback_admin_select — 002, never dropped).
--   • UPDATE  : platform admins only  (feedback_admin_update — 002, never dropped).
--   • DELETE  : none → RLS default-denies client deletes (drop 007's tenant delete).
-- RLS stays ENABLED on feedback; only the wrongly-scoped policies are corrected.
-- ============================================================================

begin;

-- Remove the tenant policies 007 wrongly placed on the public inbox.
drop policy if exists feedback_tenant_insert on public.feedback;
drop policy if exists feedback_tenant_delete on public.feedback;

-- Restore public submission (byte-for-byte the 002_feedback.sql policy).
drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback
  for insert with check (true);

commit;
