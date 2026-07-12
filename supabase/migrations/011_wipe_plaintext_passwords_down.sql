-- ============================================================================
-- P1-SEC-5 · A — (NO-OP) rollback of the plain-text password wipe
-- ============================================================================
-- The plain-text passwords wiped by 011 are intentionally unrecoverable — that is
-- the whole point of the change, and the real credentials live in auth.users, so
-- nothing depends on restoring them. There is deliberately nothing to undo.
-- (If a specific value were ever genuinely needed it would come from the pre-
-- change pg_dump backup, not from this migration.)
-- ============================================================================

-- intentionally empty
select 1;
