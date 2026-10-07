-- preview for 112 · READ-ONLY. Run BEFORE migration 112. Lists the vouchers that already have a leg on a
-- group account — these keep working for reports as they are, but cannot be EDITED (the edit re-inserts the
-- leg) until the leg is moved to a ledger under that group. Empty result = nothing to prepare.
select l.society_id, a.id as account_id, a.name as group_account, count(distinct l.voucher_id) as vouchers,
       round(sum(l.dr_minor + l.cr_minor) / 100.0, 2) as gross_amount
  from public.voucher_lines l
  join public.accounts a on a.id = l.account_id and a.society_id::text = l.society_id::text
 where coalesce(a."isGroup", false) and l.status = 'posted'
 group by 1, 2, 3
 order by 1, 2;
