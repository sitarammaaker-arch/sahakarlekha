-- 101 · add "Share Refund Payable" (2111) to every society, and the two trading groups some PACS charts lack
--       (COA critical-fix step #7 follow-up · proposed 2026-10-03 · NOT yet run anywhere — review the preview first).
--
-- WHY: the two-step share refund (approve → pay) books the amount owed to a leaving member in "Share Refund Payable".
-- New societies get it from the templates; existing societies do not (the app's load path never writes template
-- additions to the database — RM-01), so without this their first approval is refused with a "add the account" toast.
-- Separately, a read-only production check on 2026-10-03 found one PACS society without the groups 4100 / 5100,
-- so migration 100 had to skip 4101 Fertilizer Sales / 5101 Purchase there. Adding the groups lets re-running 100 add them.
--
-- WHAT CHANGES: INSERT only, same rules as migration 100. For each society (with a society_settings row) and each
-- account below that applies to its society type, the account is inserted ONLY when
--   · no account with that id exists in that society, AND
--   · no account with the same name and type exists in that society, AND
--   · its parent group exists in that society (a missing parent is skipped, never invented).
-- New accounts have ₹0 opening balance, isSystem=false, jurisdiction copied from the society's existing accounts.
-- NOT touched: any existing account, amount, opening balance, voucher, voucher_entries / voucher_lines row, ledger
-- event or role mapping.
--
-- SAFETY
--   - Every inserted (society, account) goes to account_seed_log (created by 100 if absent), which the down reads.
--   - Re-running inserts nothing new (the id then exists).
--   - Review the per-society result first: scripts/preview-101-share-refund-payable-and-pacs-groups.sql (read-only SELECT).
-- Requires 072 (app_migrations). Reversible: 101_share_refund_payable_and_pacs_groups_down.sql (removes only unused rows).

begin;

create table if not exists public.account_seed_log (
  id          bigserial primary key,
  migration   text not null,
  society_id  text not null,
  account_id  text not null,
  logged_at   timestamptz not null default now()
);
alter table public.account_seed_log enable row level security;
revoke all on public.account_seed_log from anon, authenticated;
comment on table public.account_seed_log is
  'Accounts INSERTED by a seeding migration (100+), one row per society + account; read by its down.';

-- No temporary tables: the spec and the society list are inlined, so the migration is safe even if the SQL Editor
-- runs its statements on different connections (a temp table made by one would be gone for the next).
do $$
declare r record;
begin
  for r in select * from (values
  (1, '2111', 'Share Refund Payable',  'शेयर वापसी देय',     'liability', 'current_liability', 'credit', false, false, '2100', null::text[]),
  (2, '4100', 'Trading Income',        'व्यापारिक आय',       'income',    null,                'credit', true,  false, '4000', array['pacs']),
  (3, '5100', 'Direct Expenses',       'प्रत्यक्ष व्यय',     'expense',   null,                'debit',  true,  false, '5000', array['pacs'])
    ) as t(ord, id, name, name_hi, type, subtype, nature, is_group, is_system, parent_id, society_types) order by ord loop
    with ins as (
      insert into public.accounts
        (id, society_id, name, "nameHi", type, subtype, "openingBalance", "openingBalanceType", "isSystem", "parentId", "isGroup", jurisdiction)
      select r.id, s.sid, r.name, r.name_hi, r.type, r.subtype, 0, r.nature, r.is_system, r.parent_id, r.is_group,
             (select a2.jurisdiction from public.accounts a2 where a2.society_id::text = s.sid limit 1)
      from (
        select ss.society_id::text as sid, ss."societyType" as stype
        from public.society_settings ss
        where exists (select 1 from public.accounts a where a.society_id::text = ss.society_id::text)
      ) s
      where (r.society_types is null or s.stype = any (r.society_types))
        and not exists (select 1 from public.accounts x where x.society_id::text = s.sid and x.id = r.id)
        and not exists (select 1 from public.accounts x where x.society_id::text = s.sid and lower(x.name) = lower(r.name) and x.type = r.type)
        and exists (select 1 from public.accounts p where p.society_id::text = s.sid and p.id = r.parent_id and coalesce(p."isGroup", false))
      returning society_id, id
    )
    insert into public.account_seed_log (migration, society_id, account_id)
    select '101', society_id, id from ins;
  end loop;
end $$;

insert into public.app_migrations (version, name) values ('101', 'share_refund_payable_and_pacs_groups')
  on conflict (version) do nothing;

commit;
