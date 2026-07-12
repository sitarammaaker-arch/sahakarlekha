-- ============================================================================
-- Item #4 · ROLLBACK — recreate the stale DATE overload of update_society_subscription
-- ============================================================================
-- Restores overload #1 exactly as it was in production before 013. It is dead
-- (nothing calls it), so recreating it only restores the drift; provided for
-- faithful reversibility.
-- ============================================================================

begin;

create or replace function public.update_society_subscription(
  p_society_id text, p_plan text, p_plan_expires_at date, p_is_locked boolean, p_subscription_notes text
)
returns void
language sql
security definer
set search_path to 'public', 'extensions'
as $$
  update society_settings set
    plan = p_plan,
    plan_expires_at = p_plan_expires_at,
    is_locked = p_is_locked,
    subscription_notes = p_subscription_notes
  where society_id = p_society_id;
$$;

commit;
