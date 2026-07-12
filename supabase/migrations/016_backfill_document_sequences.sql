-- 016 · Backfill document_sequences from existing document numbers (T-03 / ADR-0005).
--
-- The client now takes each new document's OFFICIAL number from the server sequence
-- next_document_number(society, book, fy). Existing societies already have vouchers, sales
-- and purchases numbered BOOK/FY/SEQ up to some max, but document_sequences is empty — so
-- without this backfill the first server-issued number would be 1 and COLLIDE with the
-- existing #1 (the client's unique-index collision-retry would then bump it, so it is safe,
-- just not yet gapless). Seeding last_number to the current max per (society, book, fy) makes
-- issuance continue exactly where the client left off — gapless from cut-over.
--
-- book = the number's prefix (split_part 1), fy = split_part 2, seq = split_part 3. ALL rows
-- are considered (including cancelled/soft-deleted) so a previously-issued number is NEVER
-- reissued. Idempotent: re-running only raises last_number (greatest), never lowers it. As
-- more entity numbering is migrated to the server sequence, add its table to the UNION below.
--
-- Run this ONCE in the Supabase SQL editor after deploying the T-03 client change.

insert into document_sequences (society_id, book, fy, last_number, updated_at)
select s.society_id, s.book, s.fy, max(s.seq), now()
from (
  select society_id,
         split_part("voucherNo", '/', 1)  as book,
         split_part("voucherNo", '/', 2)  as fy,
         (split_part("voucherNo", '/', 3))::bigint as seq
  from vouchers
  where "voucherNo" ~ '^[^/]+/[^/]+/[0-9]+$'
  union all
  select society_id,
         split_part("saleNo", '/', 1),
         split_part("saleNo", '/', 2),
         (split_part("saleNo", '/', 3))::bigint
  from sales
  where "saleNo" ~ '^[^/]+/[^/]+/[0-9]+$'
  union all
  select society_id,
         split_part("purchaseNo", '/', 1),
         split_part("purchaseNo", '/', 2),
         (split_part("purchaseNo", '/', 3))::bigint
  from purchases
  where "purchaseNo" ~ '^[^/]+/[^/]+/[0-9]+$'
  union all
  select society_id,
         split_part("loanNo", '/', 1),
         split_part("loanNo", '/', 2),
         (split_part("loanNo", '/', 3))::bigint
  from loans
  where "loanNo" ~ '^[^/]+/[^/]+/[0-9]+$'
  union all
  select society_id,
         split_part("objectionNo", '/', 1),
         split_part("objectionNo", '/', 2),
         (split_part("objectionNo", '/', 3))::bigint
  from audit_objections
  where "objectionNo" ~ '^[^/]+/[^/]+/[0-9]+$'
) s
group by s.society_id, s.book, s.fy
on conflict (society_id, book, fy)
do update set
  last_number = greatest(document_sequences.last_number, excluded.last_number),
  updated_at  = now();
