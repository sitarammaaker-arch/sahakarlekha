-- Rollback for 065_member_portal_verticals.sql - restores the 064 member_portal_snapshot()
-- (profile, shares, loans, deposits, KCC only). The portal keeps working; the S4 sections go empty.
begin;

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
