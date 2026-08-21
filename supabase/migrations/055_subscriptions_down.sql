-- 055 down — remove the subscriptions table (Phase 2a-1).
-- Safe: no code reads it until 2a-2. Dropping it reverts to the pre-Phase-2 state
-- where every society simply has no subscription row (treated as legacy by callers).
drop table if exists subscriptions cascade;
