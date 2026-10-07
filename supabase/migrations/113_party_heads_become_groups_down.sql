-- 113 down · turn the heads back into ledgers where migration 113 moved their roles and nothing has been posted to
-- the catch-all child since. Societies that began life with the heads as groups (new templates) are untouched
-- because only a role marked 'auto (migration 113)' qualifies. The catch-all children stay (harmless, ₹0).
begin;

update public.accounts a
   set "isGroup" = false
 where a.id in ('3302', '2101', '3303')
   and coalesce(a."isGroup", false)
   and exists (select 1 from public.account_roles r
                where r.society_id::text = a.society_id::text and r.updated_by = 'auto (migration 113)'
                  and r.account_id = case r.role when 'bank.default' then '3302-01' when 'supplier.payable' then '2101-01' else '3303-01' end
                  and a.id = case r.role when 'bank.default' then '3302' when 'supplier.payable' then '2101' else '3303' end)
   and not exists (select 1 from public.voucher_lines l
                    where l.society_id::text = a.society_id::text
                      and l.account_id = case a.id when '3302' then '3302-01' when '2101' then '2101-01' else '3303-01' end);

update public.account_roles r
   set account_id = case r.role when 'bank.default' then '3302' when 'supplier.payable' then '2101' else '3303' end,
       updated_by = 'migration 113 down', updated_at = now()
 where r.updated_by = 'auto (migration 113)'
   and exists (select 1 from public.accounts a
                where a.society_id::text = r.society_id::text and not coalesce(a."isGroup", false)
                  and a.id = case r.role when 'bank.default' then '3302' when 'supplier.payable' then '2101' else '3303' end);

delete from public.app_migrations where version = '113';
commit;
drop function if exists public.parent_group_plan();
