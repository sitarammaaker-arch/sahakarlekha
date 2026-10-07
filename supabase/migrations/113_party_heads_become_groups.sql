-- 113 · 3302 Bank Accounts, 2101 Sundry Creditors and 3303 Sundry Debtors become real GROUPS (existing societies).
--
-- WHY: all three are parents — every bank, supplier and customer ledger hangs under them — but the old
-- templates shipped them as ordinary ledgers, so a voucher could post straight to the head AND to its
-- children (double listing), and a head with children is the shape that Ledger Heads' "make it a group" turned
-- into the Assandh "[Deleted]" rows. New societies already get them as groups (templates, same PR).
--
-- WHAT, per society and head, ONLY where it is provably safe (public.parent_group_plan() decides — run
-- supabase/diagnostics/preview_113_party_heads.sql first):
--   * the head is still a ledger, has opening balance 0, and NOTHING references it: no voucher leg
--     (voucher_lines / voucher_entries / vouchers), no journal event, no party, bank reconciliation, sale,
--     purchase, return, salary, stock, housing or deposit row, no account role. (3303 only where it is
--     "Sundry Debtors" / "Maintenance Receivable" — in a PACS chart 3303 is "Short-term Loans (KCC)", a loan ledger.)
--   * a catch-all child is added where the head would otherwise have no postable account:
--       3302-01 "Bank Account (Main)"       — only when the society has NO bank under 3302 yet
--       2101-01 "Sundry Creditors — General"
--       3303-01 "Sundry Debtors — General"  (housing: "Maintenance Receivable — General")
--   * then the head is flagged isGroup = true.
-- A head that already has postings is NEVER touched (moving history = rewriting the append-only journal):
-- those societies keep the ledger head and are listed by the preview for a separate decision.
--
-- The three party roles (bank.default, supplier.payable, customer.receivable) that pointed at a head are moved to its
-- catch-all child; any OTHER role on the head, or an existing default bank, keeps the head a ledger.
-- Idempotent (a flipped head is no longer a ledger, so a re-run finds nothing). Nothing but the isGroup flag of
-- the head is modified; the only inserts are the catch-all children. Undo: 113_party_heads_become_groups_down.sql.
-- NO temp tables — the SQL Editor's "Run and enable RLS" splits statements.

begin;

create or replace function public.parent_group_plan()
returns table (society_id text, head_id text, eligible boolean, reason text, add_child boolean)
language sql stable
set search_path = public as $fn$
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
        -- a bank head that already has banks under it and is the default bank: which bank is the default is a choice, not ours to make
     or (h.head = '3302' and exists (select 1 from public.accounts c where c.society_id::text = h.sid and c."parentId" = '3302' and not coalesce(c."isGroup", false))
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
    from probed p;
$fn$;
revoke execute on function public.parent_group_plan() from public, anon, authenticated;

-- 1. the catch-all child, copied from its head's row (type, jurisdiction, subtype)
insert into public.accounts (id, society_id, name, "nameHi", type, "openingBalance", "openingBalanceType", "isSystem", "isGroup", "parentId", subtype, jurisdiction)
select case p.head_id when '3302' then '3302-01' when '2101' then '2101-01' else '3303-01' end,
       h.society_id,
       case p.head_id when '3302' then 'Bank Account (Main)'
                      when '2101' then 'Sundry Creditors — General'
                      else case when h.name = 'Maintenance Receivable' then 'Maintenance Receivable — General' else 'Sundry Debtors — General' end end,
       case p.head_id when '3302' then 'बैंक खाता (मुख्य)'
                      when '2101' then 'विविध लेनदार — सामान्य'
                      else case when h.name = 'Maintenance Receivable' then 'प्राप्य रखरखाव शुल्क — सामान्य' else 'विविध देनदार — सामान्य' end end,
       h.type, 0, h."openingBalanceType",
       p.head_id <> '3302',          -- the creditors/debtors catch-all is protected (system); a bank may be replaced
       false, p.head_id, h.subtype, h.jurisdiction
  from public.parent_group_plan() p
  join public.accounts h on h.society_id::text = p.society_id and h.id = p.head_id
 where p.eligible and p.add_child
on conflict do nothing;

-- 2. the three party roles that pointed at the head now point at its catch-all child (a role on a group would
--    make the posting service refuse every sale / purchase / bank voucher). Only where that child exists.
update public.account_roles r
   set account_id = case r.role when 'bank.default' then '3302-01' when 'supplier.payable' then '2101-01' else '3303-01' end,
       updated_by = 'auto (migration 113)', updated_at = now()
  from public.parent_group_plan() p
 where p.eligible
   and r.society_id::text = p.society_id and r.account_id = p.head_id
   and r.role in ('bank.default', 'supplier.payable', 'customer.receivable')
   and exists (select 1 from public.accounts c
                where c.society_id::text = p.society_id
                  and c.id = case r.role when 'bank.default' then '3302-01' when 'supplier.payable' then '2101-01' else '3303-01' end
                  and not coalesce(c."isGroup", false));

-- 3. flag the heads (only where the plan allowed it AND the head now has a postable child)
update public.accounts a
   set "isGroup" = true
  from public.parent_group_plan() p
 where p.eligible
   and a.society_id::text = p.society_id and a.id = p.head_id
   and not coalesce(a."isGroup", false)
   and exists (select 1 from public.accounts c
                where c.society_id = a.society_id and c."parentId" = a.id and not coalesce(c."isGroup", false));

insert into public.app_migrations (version, name) values ('113', 'party_heads_become_groups')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
