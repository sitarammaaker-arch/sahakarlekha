-- 016 · Backfill document_sequences from existing voucher numbers (T-03 / ADR-0005).
--
-- The client now takes each new voucher's OFFICIAL number from the server sequence
-- next_document_number(society, book, fy). Existing societies already have vouchers numbered
-- BOOK/FY/SEQ up to some max, but document_sequences is empty — so without this backfill the
-- first server-issued number would be 1 and COLLIDE with the existing #1 (the client's
-- collision-retry would then bump it, so it is safe, just not yet gapless). Seeding
-- last_number to the current max per (society, book, fy) makes issuance continue exactly
-- where the client left off — gapless from cut-over.
--
-- book = the number's prefix (split_part 1), fy = split_part 2, seq = split_part 3. All
-- vouchers are considered (including cancelled/soft-deleted) so a previously-issued number is
-- NEVER reissued. Idempotent: re-running only raises last_number (greatest), never lowers it.
--
-- Run this ONCE in the Supabase SQL editor after deploying the T-03 client change.

insert into document_sequences (society_id, book, fy, last_number, updated_at)
select
  v.society_id,
  split_part(v."voucherNo", '/', 1)                       as book,
  split_part(v."voucherNo", '/', 2)                       as fy,
  max((split_part(v."voucherNo", '/', 3))::bigint)        as last_number,
  now()
from vouchers v
where v."voucherNo" ~ '^[^/]+/[^/]+/[0-9]+$'
group by v.society_id, split_part(v."voucherNo", '/', 1), split_part(v."voucherNo", '/', 2)
on conflict (society_id, book, fy)
do update set
  last_number = greatest(document_sequences.last_number, excluded.last_number),
  updated_at  = now();
