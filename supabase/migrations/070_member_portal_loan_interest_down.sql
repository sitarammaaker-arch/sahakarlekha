-- Rollback for 070_member_portal_loan_interest.sql - restores the 067 member_portal_snapshot().
-- The portal keeps working; the interest-due column goes away.
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
  v_milk_from text;
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

  -- S4 founder decision: milk collections for the current FY (Apr-Mar) plus the month before it.
  -- Dues are NOT windowed - they come from the full settlement history, like the staff passbook.
  v_milk_from := to_char(
    make_date(case when extract(month from current_date) >= 4 then extract(year from current_date)::int
                   else extract(year from current_date)::int - 1 end, 4, 1) - interval '1 month',
    'YYYY-MM-DD');

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
    ), '[]'::jsonb),

    -- ── S4 · Dairy ── (only rows for THIS member; RULE 5: soft-deleted excluded where the column exists)
    'milkFrom', v_milk_from,
    'milkEntries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'date', e.date, 'shift', e.shift, 'memberId', e."memberId",
        'qty', e.qty, 'fat', e.fat, 'snf', e.snf, 'rate', e.rate, 'amount', e.amount
      ) order by e.date, e.shift)
      from public.milk_entries e
      where e.society_id = v_link.society_id and e."memberId" = v_member.id and e.date >= v_milk_from
    ), '[]'::jsonb),
    'dairySettlements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'settlementNo', d."settlementNo", 'memberId', d."memberId", 'from', d."from", 'to', d."to",
        'gross', d.gross, 'deductionLines', coalesce(d."deductionLines", '[]'::jsonb),
        'netPayable', d."netPayable", 'amountPaid', d."amountPaid", 'status', d.status
      ) order by d."to")
      from public.dairy_settlements d
      where d.society_id = v_link.society_id and d."memberId" = v_member.id
        and coalesce(d."isDeleted", false) = false
    ), '[]'::jsonb),
    'dairyInputIssues', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'date', i.date, 'memberId', i."memberId", 'inputType', i."inputType",
        'itemName', i."itemName", 'qty', i.qty, 'amount', i.amount
      ) order by i.date)
      from public.dairy_input_issues i
      where i.society_id = v_link.society_id and i."memberId" = v_member.id
        and coalesce(i."isDeleted", false) = false
    ), '[]'::jsonb),
    -- The one account memberInputOutstanding needs (resolveMemberInputReceivableAccountId: id 3305 or its names).
    'dairyInputAccounts', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'nameHi', a."nameHi", 'subtype', a.subtype))
      from public.accounts a
      where a.society_id = v_link.society_id and coalesce(a."isGroup", false) = false
        and (a.id = '3305' or coalesce(a."nameHi", '') like '%सदस्य आदान प्राप्य%'
             or lower(coalesce(a.name, '')) like '%member input receivable%')
    ), '[]'::jsonb),
    -- Approved runs only (founder decision); only this member's own line is returned.
    'dairyDistributions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'kind', r.kind, 'from', r."from", 'to', r."to", 'fyLabel', r."fyLabel", 'basis', r.basis,
        'rate', r.rate, 'approvedAt', r."approvedAt", 'line', ln.value
      ) order by r."approvedAt")
      from public.dairy_distributions r
      cross join lateral jsonb_array_elements(coalesce(r.lines, '[]'::jsonb)) ln
      where r.society_id = v_link.society_id and r.status = 'approved' and coalesce(r."isDeleted", false) = false
        and ln.value ->> 'memberId' = v_member.id
    ), '[]'::jsonb),

    -- ── S4 · Housing ──
    'maintenanceBills', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'billNo', b."billNo", 'flatId', b."flatId", 'flatNo', b."flatNo", 'memberId', b."memberId",
        'period', b.period, 'date', b.date, 'amount', b.amount, 'paidAmount', b."paidAmount", 'status', b.status
      ) order by b.date)
      from public.maintenance_bills b
      where b.society_id = v_link.society_id and b."memberId" = v_member.id
        and coalesce(b."isDeleted", false) = false
    ), '[]'::jsonb),
    -- Receipt / interest vouchers of THIS member's bills only (buildMemberStatement's input).
    'maintenanceVouchers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'voucherNo', v."voucherNo", 'date', v.date, 'amount', v.amount, 'narration', v.narration,
        'refType', v."refType", 'refId', v."refId"
      ) order by v.date)
      from public.vouchers v
      where v.society_id = v_link.society_id and coalesce(v."isDeleted", false) = false
        and v."refType" in ('maintenance.receipt', 'maintenance.interest')
        and v."refId" in (select b.id from public.maintenance_bills b
                          where b.society_id = v_link.society_id and b."memberId" = v_member.id
                            and coalesce(b."isDeleted", false) = false)
    ), '[]'::jsonb),
    'housingFlats', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'flatNo', f."flatNo", 'blockNo', f."blockNo", 'area', f.area,
        'monthlyMaintenance', f."monthlyMaintenance"
      ) order by f."flatNo")
      from public.housing_flats f
      where f.society_id = v_link.society_id and f."memberId" = v_member.id
        and coalesce(f."isDeleted", false) = false
    ), '[]'::jsonb),

    -- ── S4 · Consumer ── (memberOutstanding / memberAgeing inputs)
    'creditSales', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'saleNo', s."saleNo", 'date', s.date, 'memberId', s."memberId", 'paymentMode', s."paymentMode",
        'grandTotal', s."grandTotal", 'netAmount', s."netAmount"
      ) order by s.date)
      from public.sales s
      where s.society_id = v_link.society_id and s."memberId" = v_member.id and s."paymentMode" = 'credit'
        and coalesce(s."isDeleted", false) = false
    ), '[]'::jsonb),
    'creditRecoveries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'voucherNo', v."voucherNo", 'date', v.date, 'memberId', v."memberId", 'amount', v.amount
      ) order by v.date)
      from public.vouchers v
      where v.society_id = v_link.society_id and v."memberId" = v_member.id
        and v."refType" = 'consumer.member.recovery' and coalesce(v."isDeleted", false) = false
    ), '[]'::jsonb),
    'creditReturns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'returnNo', r."returnNo", 'date', r.date, 'memberId', r."memberId",
        'grandTotal', r."grandTotal", 'refundMode', r."refundMode"
      ) order by r.date)
      from public.sales_returns r
      where r.society_id = v_link.society_id and r."memberId" = v_member.id
        and r."refundMode" = 'credit-adjust' and coalesce(r."isDeleted", false) = false
    ), '[]'::jsonb),
    'patronageRuns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'kind', coalesce(r.kind, 'patronage'), 'fyLabel', r."fyLabel", 'from', r."from", 'to', r."to",
        'ratePct', r."ratePct", 'approvedAt', r."approvedAt", 'line', ln.value
      ) order by r."approvedAt")
      from public.consumer_patronage_runs r
      cross join lateral jsonb_array_elements(coalesce(r.lines, '[]'::jsonb)) ln
      where r.society_id = v_link.society_id and r.status = 'approved' and coalesce(r."isDeleted", false) = false
        and ln.value ->> 'memberId' = v_member.id
    ), '[]'::jsonb),

    -- ── 2b-2 · General dividend (066) ── the inputs of memberDividendHistory (Member-360 = portal).
    -- Approved, live runs only; each run carries ONLY this member's line (other members' lines never
    -- leave the database). total/ratePct are society-level and needed by liveRunFor.
    'dividendRuns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'fyLabel', r."fyLabel", 'kind', r.kind, 'basis', r.basis, 'ratePct', r."ratePct",
        'total', r.total, 'status', r.status, 'source', r.source,
        'lines', coalesce((
          select jsonb_agg(ln.value)
          from jsonb_array_elements(case when jsonb_typeof(r.lines) = 'array' then r.lines else '[]'::jsonb end) ln
          where ln.value ->> 'memberId' = v_member.id
        ), '[]'::jsonb)
      ) order by r."fyLabel")
      from public.member_distribution_runs r
      where r.society_id = v_link.society_id and r.kind = 'dividend' and r.status = 'approved'
        and coalesce(r."isDeleted", false) = false
    ), '[]'::jsonb),
    -- Active vouchers the shared rule reads: the society's dividend appropriations (Dr 1208 / Cr 1211)
    -- and THIS member's dividend payments (Dr 1211). Legs are checked on the legacy columns OR the
    -- compound lines (superset — the client applies getVoucherLines exactly). Lines are reduced to
    -- account/type/amount, and another member's id is never returned.
    'dividendVouchers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'voucherNo', v."voucherNo", 'type', v.type, 'date', v.date, 'createdAt', v."createdAt",
        'debitAccountId', v."debitAccountId", 'creditAccountId', v."creditAccountId", 'amount', v.amount,
        'narration', v.narration,
        'memberId', case when v."memberId" = v_member.id then v."memberId" end,
        'lines', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', l.value ->> 'id', 'accountId', l.value ->> 'accountId', 'type', l.value ->> 'type', 'amount', l.value -> 'amount'))
          from jsonb_array_elements(case when jsonb_typeof(v.lines) = 'array' then v.lines else '[]'::jsonb end) l
        ), '[]'::jsonb)
      ) order by v.date, v."createdAt")
      from public.vouchers v
      where v.society_id = v_link.society_id and coalesce(v."isDeleted", false) = false
        and (
          ((v."debitAccountId" = '1208' or coalesce(v.lines @> '[{"accountId":"1208","type":"Dr"}]'::jsonb, false))
           and (v."creditAccountId" = '1211' or coalesce(v.lines @> '[{"accountId":"1211","type":"Cr"}]'::jsonb, false)))
          or
          (v."memberId" = v_member.id
           and (v."debitAccountId" = '1211' or coalesce(v.lines @> '[{"accountId":"1211","type":"Dr"}]'::jsonb, false)))
        )
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.member_portal_snapshot() from public, anon;
grant execute on function public.member_portal_snapshot() to authenticated;

commit;
