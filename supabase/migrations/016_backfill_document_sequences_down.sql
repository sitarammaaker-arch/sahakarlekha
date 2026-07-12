-- 016 DOWN · Backfill is intentionally NOT reversible.
--
-- Deleting the seeded document_sequences rows would reset last_number, so the next
-- server-issued number would be 1 and collide with vouchers already numbered in the field —
-- exactly the harm the backfill prevents. There is nothing safe to undo. To fully retreat
-- from server-authoritative numbering, revert the T-03 client change instead; the seeded
-- rows are then simply unused and harmless.
--
-- (no-op)
select 1;
