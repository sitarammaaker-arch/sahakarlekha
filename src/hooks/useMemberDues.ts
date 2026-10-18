/**
 * Every due a member owes the society, one place for every page (founder 2026-10-18, point 1): loans + KCC
 * (outstanding), consumer credit, housing maintenance, dairy inputs — plus the SEPARATE legal-default amount
 * (voters.overdueByMember: past-due loans / KCC) that alone decides s.20(d) / r.27(a). See lib/members/legal.duesRow.
 */
import { useCallback, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useConsumerData } from '@/contexts/ConsumerDataContext';
import { useHousingData } from '@/contexts/HousingDataContext';
import { useDairyData } from '@/contexts/DairyDataContext';
import { loanOutstanding, kccOutstanding } from '@/lib/memberSnapshot';
import { overdueByMember } from '@/lib/members/voters';
import { memberInputOutstanding } from '@/lib/dairy/inputs';
import { resolveMemberInputReceivableAccountId } from '@/lib/dairy/accounts';
import { duesRow, type DuesRow } from '@/lib/members/legal';

export function useMemberDues(asOf: string): (memberId: string) => DuesRow {
  const { loans, kccLoans, accounts } = useData();
  const { getMemberOutstanding } = useConsumerData();
  const { maintenanceBills } = useHousingData();
  const { inputIssues, settlements } = useDairyData();
  const overdue = useMemo(() => overdueByMember(loans, kccLoans, asOf), [loans, kccLoans, asOf]);
  const inputAcc = useMemo(() => resolveMemberInputReceivableAccountId(accounts), [accounts]);
  return useCallback((memberId: string) => duesRow({
    loans: loans.filter(l => l.memberId === memberId && !l.isDeleted && l.status !== 'cleared').reduce((s, l) => s + Math.max(0, loanOutstanding(l)), 0),
    kcc: kccLoans.filter(k => k.memberId === memberId).reduce((s, k) => s + Math.max(0, kccOutstanding(k)), 0),
    consumer: getMemberOutstanding(memberId) || 0,
    housing: maintenanceBills.filter(b => b.memberId === memberId && !b.isDeleted).reduce((s, b) => s + Math.max(0, (b.amount || 0) - (b.paidAmount || 0)), 0),
    dairyInputs: inputAcc ? memberInputOutstanding(inputIssues, settlements, memberId, inputAcc).outstanding : 0,
    legalDefault: overdue.get(memberId)?.amount ?? 0,
  }), [loans, kccLoans, getMemberOutstanding, maintenanceBills, inputIssues, settlements, inputAcc, overdue]);
}
