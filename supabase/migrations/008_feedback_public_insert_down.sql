-- ============================================================================
-- P1-SEC-2 · ROLLBACK of 008 — re-apply 007's tenant scoping to feedback
-- ============================================================================
-- Reverses 008_feedback_public_insert.sql: drops the public feedback_insert and
-- restores the tenant-scoped insert/delete policies 007 had created.
--
-- WARNING: running this RE-BREAKS public feedback submission (anonymous visitors
-- can no longer submit contact messages / reviews). It exists only for faithful
-- reversibility of 008; the tenant scoping of a public inbox is NOT desirable.
-- ============================================================================

begin;

drop policy if exists feedback_insert on public.feedback;

create policy feedback_tenant_insert on public.feedback
  for insert with check (society_id::text = get_current_society_id());

create policy feedback_tenant_delete on public.feedback
  for delete using (society_id::text = get_current_society_id());

commit;
