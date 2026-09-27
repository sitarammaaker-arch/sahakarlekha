-- RM-02 · Per-society pre-flight diagnostic (Phase-3 S0 gate, M1-0).
--
-- READ-ONLY. One SELECT, one row per society. It REPORTS what the S1+ migrations must know
-- about each tenant; it never fixes anything. Run only through scripts/rm02-diagnostics.mjs,
-- which wraps it in `begin transaction read only; …; rollback;`.
--
-- Column notes
--   fy_*                  society_settings FY fields as stored (label, raw start, prev label, locks)
--   fy_label_valid        label looks like 'YYYY-YY' with YY = YYYY+1 (mod 100)
--   vouchers_outside_fy   live vouchers dated outside the label's 1 Apr – 31 Mar window
--   vouchers_before_2000  live vouchers dated before 2000-01-01 (M0: 1950–88 dates exist)
--   auto_member_*         vouchers shaped like the removed RM-01 load loop (createdBy 'System')
--   auto_member_with_other_posting  of those, ones where another live voucher also credits the
--                         same account (1102 share / 4407 admission) for the same member — likely doubles
--   unbalanced_vouchers   live multi-line vouchers where ΣDr ≠ ΣCr (> ₹0.005)
--   orphan_leg_vouchers   live vouchers with a leg on an account id this society does not have
--   *_posting             ledger_events (journal) vs vouchers parity
--   dup_account_groups    groups of accounts with the same normalised name under the same parent
--   share_register / gl_share_capital   Σ members.shareCapital vs the 1102 ledger (opening + postings).
--                         1102 is share capital only in templates that use it so — acc_1102_name says
--                         what 1102 is in this society (the hard-coded-code problem RM-05 removes).

with
settings as (
  select s.society_id::text as society_id,
         to_jsonb(s) as j
  from society_settings s
),
soc as (
  select st.society_id,
         coalesce(st.j->>'name', so.name) as society_name,
         st.j->>'societyType' as society_type,
         st.j->>'financialYear' as fy_label,
         st.j->>'financialYearStart' as fy_start_raw,
         st.j->>'previousFinancialYear' as fy_prev_label,
         st.j->>'periodLockDate' as period_lock_date,
         coalesce((st.j->>'fyLocked')::boolean, false) as fy_locked
  from settings st
  left join societies so on so.id::text = st.society_id
),
fy as (
  select society_id,
         (fy_label ~ '^\d{4}-\d{2}$'
          and (substr(fy_label, 6, 2))::int = ((substr(fy_label, 1, 4))::int + 1) % 100) as fy_label_valid,
         case when fy_label ~ '^\d{4}-\d{2}$'
              then make_date((substr(fy_label, 1, 4))::int, 4, 1) end as fy_from,
         case when fy_label ~ '^\d{4}-\d{2}$'
              then make_date((substr(fy_label, 1, 4))::int + 1, 3, 31) end as fy_to
  from soc
),
v as (
  select vv.society_id::text as society_id,
         vv.id,
         coalesce(vv."isDeleted", false) as is_deleted,
         case when vv.date::text ~ '^\d{4}-\d{2}-\d{2}' then (substr(vv.date::text, 1, 10))::date end as vdate,
         vv."createdBy" as created_by,
         vv.narration,
         vv."memberId" as member_id,
         vv.lines::jsonb as lines,
         vv."debitAccountId" as dr_acc,
         vv."creditAccountId" as cr_acc,
         coalesce(nullif(vv.amount::text, '')::numeric, 0) as amount
  from vouchers vv
),
legs as (
  select v.society_id, v.id as vid, l->>'accountId' as acc, l->>'type' as typ,
         coalesce(nullif(l->>'amount', '')::numeric, 0) as amt
  from v
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(v.lines) = 'array' then v.lines else '[]'::jsonb end) l
  where not v.is_deleted
  union all
  select society_id, id, dr_acc, 'Dr', amount from v
  where not is_deleted and dr_acc is not null
    and (lines is null or jsonb_typeof(lines) <> 'array' or jsonb_array_length(lines) = 0)
  union all
  select society_id, id, cr_acc, 'Cr', amount from v
  where not is_deleted and cr_acc is not null
    and (lines is null or jsonb_typeof(lines) <> 'array' or jsonb_array_length(lines) = 0)
),
acc as (
  select society_id::text as society_id, id, name, "parentId" as parent_id,
         coalesce(nullif("openingBalance"::text, '')::numeric, 0) as ob,
         "openingBalanceType" as obt
  from accounts
),
ev as (
  select society_id::text as society_id, aggregate_id, event_type
  from ledger_events
  where aggregate_type = 'voucher'
),
ev_by_voucher as (
  select society_id, aggregate_id,
         bool_or(event_type in ('voucher.posted', 'voucher.reposted')) as has_posting,
         bool_or(event_type = 'voucher.cancelled') as has_cancel
  from ev group by 1, 2
),
auto_mv as (
  select society_id, id, member_id,
         case when narration like 'Share Capital received from%' then 'share' else 'admission' end as kind
  from v
  where not is_deleted and created_by = 'System' and member_id is not null
    and (narration like 'Share Capital received from%' or narration like 'Admission Fee received from%')
),
m_voucher as (
  select v.society_id,
         count(*) filter (where not v.is_deleted) as vouchers_live,
         count(*) filter (where v.is_deleted) as vouchers_deleted,
         count(*) filter (where not v.is_deleted and fy.fy_from is not null
                          and (v.vdate < fy.fy_from or v.vdate > fy.fy_to)) as vouchers_outside_fy,
         count(*) filter (where not v.is_deleted and v.vdate < date '2000-01-01') as vouchers_before_2000,
         count(*) filter (where not v.is_deleted and v.vdate is null) as vouchers_bad_date,
         count(*) filter (where not v.is_deleted and coalesce(e.has_posting, false) = false) as live_without_posting,
         count(*) filter (where v.is_deleted and coalesce(e.has_posting, false)
                          and coalesce(e.has_cancel, false) = false) as cancelled_with_live_posting
  from v
  left join fy on fy.society_id = v.society_id
  left join ev_by_voucher e on e.society_id = v.society_id and e.aggregate_id = v.id
  group by v.society_id
),
m_auto as (
  select society_id,
         count(*) as auto_member_vouchers,
         count(distinct member_id) as auto_member_members,
         (select count(*) from (
            select 1 from auto_mv a2 where a2.society_id = a.society_id
            group by a2.member_id, a2.kind having count(*) > 1) d) as auto_member_dup_member_kinds
  from auto_mv a group by society_id
),
m_auto_other as (
  select a.society_id, count(*) as auto_member_with_other_posting
  from auto_mv a
  where exists (
    select 1 from legs l join v v2 on v2.society_id = l.society_id and v2.id = l.vid
    where l.society_id = a.society_id and v2.member_id = a.member_id and v2.id <> a.id
      and l.typ = 'Cr' and l.acc = case a.kind when 'share' then '1102' else '4407' end)
  group by a.society_id
),
m_balance as (
  select society_id,
         count(*) filter (where abs(dr - cr) > 0.005) as unbalanced_vouchers
  from (
    select society_id, vid,
           sum(amt) filter (where typ = 'Dr') as dr,
           sum(amt) filter (where typ = 'Cr') as cr
    from legs group by 1, 2
  ) t
  group by society_id
),
m_orphan as (
  select l.society_id, count(distinct l.vid) as orphan_leg_vouchers
  from legs l
  left join acc a on a.society_id = l.society_id and a.id = l.acc
  where a.id is null
  group by l.society_id
),
m_ev_orphan as (
  select e.society_id, count(*) as posting_without_voucher
  from ev_by_voucher e
  left join v on v.society_id = e.society_id and v.id = e.aggregate_id
  where e.has_posting and v.id is null
  group by e.society_id
),
m_entries as (
  select ve.society_id::text as society_id,
         count(*) filter (where v.id is null) as entries_orphan,
         count(*) filter (where v.is_deleted) as entries_of_deleted_vouchers
  from voucher_entries ve
  left join v on v.society_id = ve.society_id::text and v.id = ve."voucherId"
  group by 1
),
m_docs as (
  select society_id, sum(sales_nv) as sales_without_voucher, sum(purch_nv) as purchases_without_voucher
  from (
    select s.society_id::text as society_id, 1 as sales_nv, 0 as purch_nv
    from sales s
    left join v on v.society_id = s.society_id::text and v.id = s."voucherId" and not v.is_deleted
    where not coalesce(s."isDeleted", false) and v.id is null
    union all
    select p.society_id::text, 0, 1
    from purchases p
    left join v on v.society_id = p.society_id::text and v.id = p."voucherId" and not v.is_deleted
    where not coalesce(p."isDeleted", false) and v.id is null
  ) t group by society_id
),
m_dup_acc as (
  select society_id, count(*) as dup_account_groups, coalesce(sum(n - 1), 0) as dup_account_extra_rows
  from (
    select society_id, lower(btrim(name)) as nm, coalesce(parent_id, '') as p, count(*) as n
    from acc group by 1, 2, 3 having count(*) > 1
  ) t group by society_id
),
m_share as (
  select s.society_id,
         (select coalesce(sum(nullif(m."shareCapital"::text, '')::numeric), 0)
            from members m
           where m.society_id::text = s.society_id and not coalesce(m."isDeleted", false)) as share_register,
         (select coalesce(sum(case when lower(a.obt) in ('debit', 'dr') then -a.ob else a.ob end), 0)
            from acc a where a.society_id = s.society_id and a.id = '1102')
         + (select coalesce(sum(case when l.typ = 'Cr' then l.amt else -l.amt end), 0)
              from legs l where l.society_id = s.society_id and l.acc = '1102') as gl_share_capital,
         (select a.name from acc a where a.society_id = s.society_id and a.id = '1102' limit 1) as acc_1102_name
  from soc s
)
select s.society_id,
       s.society_name,
       s.society_type,
       s.fy_label,
       fy.fy_label_valid,
       s.fy_start_raw,
       (s.fy_start_raw ~ '^\d{4}-\d{2}-\d{2}$') as fy_start_is_date,
       s.fy_prev_label,
       (s.fy_prev_label is not null and s.fy_prev_label = s.fy_label) as fy_prev_equals_current,
       s.period_lock_date,
       s.fy_locked,
       coalesce(mv.vouchers_live, 0)               as vouchers_live,
       coalesce(mv.vouchers_deleted, 0)            as vouchers_deleted,
       coalesce(mv.vouchers_outside_fy, 0)         as vouchers_outside_fy,
       coalesce(mv.vouchers_before_2000, 0)        as vouchers_before_2000,
       coalesce(mv.vouchers_bad_date, 0)           as vouchers_bad_date,
       coalesce(ma.auto_member_vouchers, 0)        as auto_member_vouchers,
       coalesce(ma.auto_member_members, 0)         as auto_member_members,
       coalesce(ma.auto_member_dup_member_kinds, 0) as auto_member_dup_member_kinds,
       coalesce(mao.auto_member_with_other_posting, 0) as auto_member_with_other_posting,
       coalesce(mb.unbalanced_vouchers, 0)         as unbalanced_vouchers,
       coalesce(mo.orphan_leg_vouchers, 0)         as orphan_leg_vouchers,
       coalesce(mv.live_without_posting, 0)        as live_without_posting,
       coalesce(mv.cancelled_with_live_posting, 0) as cancelled_with_live_posting,
       coalesce(me.posting_without_voucher, 0)     as posting_without_voucher,
       coalesce(mn.entries_orphan, 0)              as entries_orphan,
       coalesce(mn.entries_of_deleted_vouchers, 0) as entries_of_deleted_vouchers,
       coalesce(md.sales_without_voucher, 0)       as sales_without_voucher,
       coalesce(md.purchases_without_voucher, 0)   as purchases_without_voucher,
       coalesce(mda.dup_account_groups, 0)         as dup_account_groups,
       coalesce(mda.dup_account_extra_rows, 0)     as dup_account_extra_rows,
       ms.share_register,
       ms.gl_share_capital,
       ms.acc_1102_name
from soc s
left join fy          on fy.society_id  = s.society_id
left join m_voucher mv on mv.society_id = s.society_id
left join m_auto ma    on ma.society_id = s.society_id
left join m_auto_other mao on mao.society_id = s.society_id
left join m_balance mb on mb.society_id = s.society_id
left join m_orphan mo  on mo.society_id = s.society_id
left join m_ev_orphan me on me.society_id = s.society_id
left join m_entries mn on mn.society_id = s.society_id
left join m_docs md    on md.society_id = s.society_id
left join m_dup_acc mda on mda.society_id = s.society_id
left join m_share ms   on ms.society_id = s.society_id
order by coalesce(mv.vouchers_live, 0) desc, s.society_name
