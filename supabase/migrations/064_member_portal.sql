-- ============================================================
-- SahakarLekha — Member Portal S1: member login link + read-only snapshot RPC.
-- Run in Supabase SQL Editor. Additive only: no existing table, policy or function changes.
--
-- SECURITY MODEL
--   • A member logs in as a Supabase Auth user whose email is on a members-only domain, so it is
--     NEVER in society_users ⇒ get_current_society_id() is NULL ⇒ every tenant RLS policy (007)
--     returns ZERO rows for them. They cannot read any table directly.
--   • member_portal_users maps auth.uid() → (society_id, member_id). RLS on, NO policies, and all
--     privileges revoked from anon/authenticated ⇒ only SECURITY DEFINER functions and
--     service_role (the S2 Edge Function that issues/revokes logins) can touch it.
--   • member_portal_snapshot() takes NO parameters — the member is resolved from auth.uid() alone,
--     so a caller cannot ask for someone else's data (no IDOR surface).
--   • It returns RAW rows only; the portal computes balances with the same pure functions the
--     staff pages use (src/lib/memberSnapshot.ts — RULE 2). Aadhaar/PAN are masked here.
--   • Plan gate (founder decision 2026-09-25): allowed plans plus/pro/enterprise/legacy/trial with
--     status active/trialing/grace. A missing subscriptions row = legacy/active, exactly like
--     useSubscription.ts. starter, or any plan with status expired ⇒ denied.
-- ============================================================

begin;

create table if not exists public.member_portal_users (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  society_id   text not null,
  member_id    text not null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   text,
  revoked_at   timestamptz,
  revoked_by   text,
  unique (society_id, member_id)
);

alter table public.member_portal_users enable row level security;
revoke all on public.member_portal_users from anon, authenticated;

create or replace function public.member_portal_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_link   public.member_portal_users%rowtype;
  v_member public.members%rowtype;
  v_plan   text;
  v_status text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'no_access');
  end if;

  select * into v_link from public.member_portal_users where auth_user_id = v_uid;
  if not found or not v_link.is_active then
    return jsonb_build_object('ok', false, 'reason', 'no_access');
  end if;

  select * into v_member from public.members
  where id = v_link.member_id and society_id = v_link.society_id and coalesce("isDeleted", false) = false;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_access');
  end if;
  if v_member.status in ('resigned', 'expelled', 'deceased') then
    return jsonb_build_object('ok', false, 'reason', 'member_inactive');
  end if;

  select plan, status into v_plan, v_status from public.subscriptions where society_id = v_link.society_id;
  v_plan := coalesce(v_plan, 'legacy');
  v_status := coalesce(v_status, 'active');
  if v_plan not in ('plus', 'pro', 'enterprise', 'legacy', 'trial')
     or v_status not in ('active', 'trialing', 'grace') then
    return jsonb_build_object('ok', false, 'reason', 'plan_unavailable');
  end if;

  return jsonb_build_object(
    'ok', true,
    'society', (
      select jsonb_build_object('name', s.name, 'nameHi', s."nameHi", 'address', s.address)
      from public.society_settings s where s.society_id = v_link.society_id limit 1
    ),
    'member', jsonb_build_object(
      'id', v_member.id,
      'memberId', v_member."memberId",
      'name', v_member.name,
      'fatherName', v_member."fatherName",
      'address', v_member.address,
      'phone', v_member.phone,
      'memberType', v_member."memberType",
      'joinDate', v_member."joinDate",
      'status', v_member.status,
      'shareCapital', v_member."shareCapital",
      'shareCount', v_member."shareCount",
      'shareFaceValue', v_member."shareFaceValue",
      'shareCertNo', v_member."shareCertNo",
      'nomineeName', v_member."nomineeName",
      'nomineeRelation', v_member."nomineeRelation",
      'nominees', coalesce(v_member.nominees, '[]'::jsonb),
      'kycStatus', v_member."kycStatus",
      'aadhaarMasked', case when coalesce(v_member.aadhaar, '') = '' then null
                            else 'XXXX-XXXX-' || right(regexp_replace(v_member.aadhaar, '\D', '', 'g'), 4) end,
      'panMasked', case when coalesce(v_member.pan, '') = '' then null
                        else 'XXXXX' || right(v_member.pan, 5) end
    ),
    -- Share-capital vouchers only (account 1102), active only (RULE 5) — the input to
    -- buildMemberShareLedger. Other vouchers tagged to the member are NOT exposed.
    'shareVouchers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'voucherNo', v."voucherNo", 'type', v.type, 'date', v.date,
        'createdAt', v."createdAt", 'debitAccountId', v."debitAccountId",
        'creditAccountId', v."creditAccountId", 'amount', v.amount,
        'narration', v.narration, 'memberId', v."memberId"
      ) order by v.date, v."createdAt")
      from public.vouchers v
      where v.society_id = v_link.society_id and v."memberId" = v_member.id
        and coalesce(v."isDeleted", false) = false
        and (v."creditAccountId" = '1102' or v."debitAccountId" = '1102')
    ), '[]'::jsonb),
    'loans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'loanNo', l."loanNo", 'loanType', l."loanType", 'purpose', l.purpose,
        'amount', l.amount, 'interestRate', l."interestRate",
        'disbursementDate', l."disbursementDate", 'dueDate', l."dueDate",
        'repaidAmount', l."repaidAmount", 'status', l.status
      ) order by l."disbursementDate")
      from public.loans l
      where l.society_id = v_link.society_id and l."memberId" = v_member.id
        and coalesce(l."isDeleted", false) = false
    ), '[]'::jsonb),
    'deposits', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'accountNo', d."accountNo", 'depositType', d."depositType",
        'openDate', d."openDate", 'balance', d.balance, 'interestRate', d."interestRate",
        'maturityDate', d."maturityDate", 'installmentAmount', d."installmentAmount",
        'status', d.status
      ) order by d."openDate")
      from public.deposit_accounts d
      where d.society_id = v_link.society_id and d."memberId" = v_member.id
    ), '[]'::jsonb),
    'depositTransactions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'depositAccountId', t."depositAccountId", 'date', t.date,
        'txnType', t."txnType", 'amount', t.amount, 'balanceAfter', t."balanceAfter"
      ) order by t.date, t."createdAt")
      from public.deposit_transactions t
      join public.deposit_accounts d on d.id = t."depositAccountId" and d.society_id = t.society_id
      where t.society_id = v_link.society_id and d."memberId" = v_member.id
    ), '[]'::jsonb),
    'kccLoans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', k.id, 'loanNo', k."loanNo", 'cropName', k."cropName", 'cropSeason', k."cropSeason",
        'sanctionedAmount', k."sanctionedAmount", 'drawnAmount', k."drawnAmount",
        'repaidAmount', k."repaidAmount", 'outstandingAmount', k."outstandingAmount",
        'interestRate', k."interestRate", 'disbursementDate', k."disbursementDate",
        'dueDate', k."dueDate", 'status', k.status
      ) order by k."disbursementDate")
      from public.kcc_loans k
      where k.society_id = v_link.society_id and k."memberId" = v_member.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.member_portal_snapshot() from public, anon;
grant execute on function public.member_portal_snapshot() to authenticated;

commit;

-- ── Verify (run after) ──
-- 1. Table + RLS on + zero policies:
--    select relrowsecurity, (select count(*) from pg_policies where tablename = 'member_portal_users') as policies
--    from pg_class where relname = 'member_portal_users';                         -- expect: true, 0
-- 2. Function is SECURITY DEFINER, zero args, anon cannot execute:
--    select prosecdef, pronargs, has_function_privilege('anon', oid, 'EXECUTE') as anon_exec
--    from pg_proc where proname = 'member_portal_snapshot';                       -- expect: true, 0, false
-- 3. Every column the RPC reads exists (plpgsql only checks them when a member actually calls it):
--    select c.t || '.' || c.col as missing from (values
--      ('members','memberId'),('members','fatherName'),('members','memberType'),('members','joinDate'),
--      ('members','shareCapital'),('members','shareCount'),('members','shareFaceValue'),('members','shareCertNo'),
--      ('members','nomineeName'),('members','nomineeRelation'),('members','nominees'),('members','kycStatus'),
--      ('members','aadhaar'),('members','pan'),('members','isDeleted'),('loans','isDeleted'),
--      ('society_settings','nameHi'),('deposit_accounts','installmentAmount'),('deposit_transactions','balanceAfter'),
--      ('kcc_loans','outstandingAmount'),('vouchers','isDeleted')
--    ) as c(t, col)
--    where not exists (select 1 from information_schema.columns i
--                      where i.table_schema = 'public' and i.table_name = c.t and i.column_name = c.col);
--                                                                                 -- expect: 0 rows
