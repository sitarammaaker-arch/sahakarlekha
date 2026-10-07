-- preview for 113 · READ-ONLY. Run BEFORE migration 113. One row per society and head (3302 / 2101 / 3303)
-- that is still a ledger: `eligible` = true means migration 113 will make it a group (adding the catch-all
-- child where `add_child`, and moving its default role to that child); false = it is left exactly as it is,
-- and `reason` says why. Nothing is written.
select * from (
  with heads as (
    select a.society_id::text as sid, a.id as head, a.name, coalesce(a."openingBalance", 0) as ob
      from public.accounts a
     where a.id in ('3302', '2101', '3303')
       and not coalesce(a."isGroup", false)
       and (a.id <> '3303' or a.name in ('Sundry Debtors', 'Maintenance Receivable'))
  ), probed as (
    select h.sid, h.head, h.ob,
      (select count(*) from public.accounts c where c.society_id::text = h.sid and c."parentId" = h.head and not coalesce(c."isGroup", false)) as kids,
      case h.head when '3302' then '3302-01' when '2101' then '2101-01' else '3303-01' end as child_id,
      ( exists (select 1 from public.voucher_lines x where x.society_id::text = h.sid and x.account_id = h.head)
     or exists (select 1 from public.voucher_entries x where x.society_id::text = h.sid and x."accountId" = h.head)
     or exists (select 1 from public.vouchers x where x.society_id::text = h.sid and (x."debitAccountId" = h.head or x."creditAccountId" = h.head))
     or exists (select 1 from public.ledger_events e, jsonb_array_elements(coalesce(e.payload -> 'lines', '[]'::jsonb)) l
                 where e.society_id::text = h.sid and l ->> 'accountId' = h.head)
      ) as has_postings,
      ( exists (select 1 from public.bank_reconciliations x where x.society_id::text = h.sid and x."bankAccountId" = h.head)
     or exists (select 1 from public.customers x where x.society_id::text = h.sid and x."accountId" = h.head)
     or exists (select 1 from public.suppliers x where x.society_id::text = h.sid and x."accountId" = h.head)
     or exists (select 1 from public.departments x where x.society_id::text = h.sid and x."accountId" = h.head)
     or exists (select 1 from public.dairy_input_issues x where x.society_id::text = h.sid and x."incomeAccountId" = h.head)
     or exists (select 1 from public.deposit_transactions x where x.society_id::text = h.sid and x."depositAccountId" = h.head)
     or exists (select 1 from public.housing_charge_heads x where x.society_id::text = h.sid and x."accountId" = h.head)
     or exists (select 1 from public.housing_flats x where x.society_id::text = h.sid and x."receivableAccountId" = h.head)
     or exists (select 1 from public.housing_fund_investments x where x.society_id::text = h.sid and (x."fundAccountId" = h.head or x."investmentAccountId" = h.head))
     or exists (select 1 from public.maintenance_bills x where x.society_id::text = h.sid and x."receivableAccountId" = h.head)
     or exists (select 1 from public.procurement_deduction_rules x where x.society_id::text = h.sid and x."accountId" = h.head)
     or exists (select 1 from public.purchase_returns x where x.society_id::text = h.sid and x."bankAccountId" = h.head)
     or exists (select 1 from public.purchases x where x.society_id::text = h.sid and x."bankAccountId" = h.head)
     or exists (select 1 from public.salary_records x where x.society_id::text = h.sid and x."bankAccountId" = h.head)
     or exists (select 1 from public.sales x where x.society_id::text = h.sid and x."bankAccountId" = h.head)
     or exists (select 1 from public.sales_returns x where x.society_id::text = h.sid and x."bankAccountId" = h.head)
     or exists (select 1 from public.stock_items x where x.society_id::text = h.sid and (x."purchaseAccountId" = h.head or x."salesAccountId" = h.head))
     or exists (select 1 from public.account_roles x where x.society_id::text = h.sid and x.account_id = h.head
                 and x.role not in ('bank.default', 'supplier.payable', 'customer.receivable'))
        -- a bank head that already has banks of its own under it (not our own 3302-01) and is the default bank: which bank is the default is a choice, not ours to make
     or (h.head = '3302' and exists (select 1 from public.accounts c where c.society_id::text = h.sid and c."parentId" = '3302' and c.id <> '3302-01' and not coalesce(c."isGroup", false))
         and exists (select 1 from public.account_roles x where x.society_id::text = h.sid and x.account_id = '3302' and x.role = 'bank.default'))
      ) as has_links
    from heads h
  )
  select p.sid as society_id, p.head as head_id,
         (abs(p.ob) < 0.005 and not p.has_postings and not p.has_links
          and (p.kids > 0 or not exists (select 1 from public.accounts c where c.society_id::text = p.sid and c.id = p.child_id))) as eligible,
         case when abs(p.ob) >= 0.005 then 'opening balance'
              when p.has_postings then 'has postings'
              when p.has_links then 'referenced by a party / bank / other role / document'
              when p.kids = 0 and exists (select 1 from public.accounts c where c.society_id::text = p.sid and c.id = p.child_id) then 'catch-all id already used'
              else 'ok' end as reason,
         -- the bank head needs a child only when it has none; the party heads always get their catch-all
         (p.head <> '3302' or p.kids = 0) as add_child
    from probed p
) plan
order by eligible desc, head_id, society_id;
