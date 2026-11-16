/**
 * Recording a member-loan repayment — the ONE posting routine, used by the Loan Register's repay dialog and by the
 * monthly recovery (Deposits → recovery list). Moved here unchanged from pages/LoanRegister.tsx so the two screens
 * cannot drift apart.
 *
 * Posts a receipt voucher (Dr Cash/Bank / Cr Loans & Advances principal / Cr interest), then bumps repaidAmount.
 * Only the principal reduces the outstanding. Returns true only when the receipt (and, where needed, the
 * reserve-release journal) really exists — a refused voucher leaves the loan untouched and returns false.
 */
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { defaultBankAccountId } from '@/lib/storage';
import { loanOutstanding } from '@/lib/memberSnapshot';
import { interestIncomeAccountId, memberLoanAccountId } from '@/lib/loans/accounts';
import {
  repaymentInterestSplit, REF_LOAN_REPAYMENT, REF_LOAN_INTEREST_RELEASE,
  ACC_INTEREST_RECEIVABLE, ACC_OVERDUE_INTEREST_RESERVE, type LoanInterestDue,
} from '@/lib/loans/interestAccrual';
import type { Loan } from '@/types';

export type RecordRepayment = (loan: Loan, totalAmt: number, interestAmt: number, mode: 'cash' | 'bank', date: string, opts?: { silent?: boolean }) => boolean;

/** @param dueOf the loan's open accrued interest (loanInterestDue over the society's accruals and vouchers). */
export function useLoanRepayment(dueOf: (loanId: string) => LoanInterestDue): RecordRepayment {
  const { members, updateLoan, society, addVoucher, cancelVoucher, accounts } = useData();
  const { user } = useAuth();
  const { toast } = useToast();
  const { language } = useLanguage();
  const hi = language === 'hi';

  // Record a loan repayment: post a receipt voucher (Dr Cash/Bank / Cr Loans&Advances
  // 3304 principal / Cr Interest Income 4408 interest), then bump repaidAmount. Only the
  // principal reduces outstanding; interest is booked as income. Fixes the GL gap where
  // editing repaidAmount recorded the cash nowhere.
  const recordRepayment = (loan: Loan, totalAmt: number, interestAmt: number, mode: 'cash' | 'bank', date: string, opts?: { silent?: boolean }): boolean => {
    if (society.fyLocked) { toast({ title: hi ? 'FY लॉक' : 'FY Locked', variant: 'destructive' }); return false; }
    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    const interest = round2(Math.max(0, Math.min(interestAmt, totalAmt)));
    const principal = round2(totalAmt - interest);
    // Principal can never exceed what is outstanding (a negative balance hides a data error).
    if (principal > loanOutstanding(loan) + 0.005) {
      toast({ title: hi ? 'मूलधन बकाया से ज़्यादा है' : 'Principal exceeds outstanding', description: hi ? 'अतिरिक्त राशि ब्याज में लिखें या चुकौती कम करें।' : 'Enter the extra as interest or reduce the repayment.', variant: 'destructive' });
      return false;
    }
    const newRepaid = round2(loan.repaidAmount + principal);
    const loanAccId = memberLoanAccountId(accounts);   // exact 3304 first; never the KCC head
    const debitAccId = mode === 'bank' ? defaultBankAccountId(accounts) : '3301';
    const lid = () => crypto.randomUUID();
    // H2-2: interest already accrued for THIS loan clears the receivable (3313) — never income twice;
    // only interest that was never accrued goes to income. Overdue first (founder decision D4).
    const split = repaymentInterestSplit(interest, dueOf(loan.id));
    const incomeAccId = interestIncomeAccountId(accounts);   // income, never 2208 Interest Payable
    const lines: { id: string; accountId: string; type: 'Dr' | 'Cr'; amount: number }[] = [{ id: lid(), accountId: debitAccId, type: 'Dr', amount: totalAmt }];
    if (principal > 0) lines.push({ id: lid(), accountId: loanAccId, type: 'Cr', amount: principal });
    if (split.toReceivable > 0) lines.push({ id: lid(), accountId: ACC_INTEREST_RECEIVABLE, type: 'Cr', amount: split.toReceivable });
    if (split.toIncome > 0) lines.push({ id: lid(), accountId: incomeAccId, type: 'Cr', amount: split.toIncome });
    const member = members.find(m => m.id === loan.memberId);
    // The receipt voucher is the record of the cash — if it was refused (permission / FY lock /
    // expired plan → empty id) or threw, the loan must NOT be marked repaid.
    let posted = false;
    let receiptId = '';
    try {
      const v = addVoucher({
        type: 'receipt', date, debitAccountId: debitAccId, creditAccountId: loanAccId, amount: totalAmt, lines,
        narration: `Loan repayment — ${member?.name || loan.memberId} (${loan.loanNo})${interest > 0 ? ` incl. interest ₹${interest.toLocaleString('en-IN')}` : ''}`,
        createdBy: user?.name ?? 'System', memberId: loan.memberId,
        refType: REF_LOAN_REPAYMENT, refId: loan.id,
      } as Parameters<typeof addVoucher>[0]);
      posted = !!v?.id;
      receiptId = v?.id || '';
    } catch { posted = false; }
    if (!posted) {
      toast({ title: hi ? 'चुकौती दर्ज नहीं हुई' : 'Repayment NOT recorded', description: hi ? 'रसीद वाउचर नहीं बना, इसलिए ऋण में कोई बदलाव नहीं किया गया।' : 'The receipt voucher was not created, so the loan was left unchanged.', variant: 'destructive', duration: 10000 });
      return false;
    }
    // Overdue interest now recovered leaves the Overdue Interest Reserve for income (Haryana Act
    // s.87 Explanation (ii)) — its own journal, so the receipt's amount stays the cash received.
    if (split.releaseFromReserve > 0) {
      let released = false;
      try {
        const r = addVoucher({
          type: 'journal', date, debitAccountId: ACC_OVERDUE_INTEREST_RESERVE, creditAccountId: incomeAccId, amount: split.releaseFromReserve,
          narration: `Overdue interest recovered — ${member?.name || loan.memberId} (${loan.loanNo}): reserve to income (s.87 Explanation (ii))`,
          createdBy: user?.name ?? 'System', memberId: loan.memberId,
          refType: REF_LOAN_INTEREST_RELEASE, refId: loan.id,
        } as Parameters<typeof addVoucher>[0]);
        released = !!r?.id;
      } catch { released = false; }
      if (!released) {
        // RULE 1: both entries or neither — take the receipt back out and leave the loan unchanged.
        cancelVoucher(receiptId, 'Reserve release failed — auto-cancelled', user?.name ?? 'System');
        toast({ title: hi ? 'चुकौती दर्ज नहीं हुई' : 'Repayment NOT recorded', description: hi ? 'अतिदेय ब्याज संचय से आय का जर्नल नहीं बना, इसलिए रसीद भी रद्द कर दी गई और ऋण में कोई बदलाव नहीं हुआ।' : 'The reserve-to-income journal was not created, so the receipt was cancelled too and the loan was left unchanged.', variant: 'destructive', duration: 10000 });
        return false;
      }
    }
    updateLoan(loan.id, { repaidAmount: newRepaid, status: (loan.amount - newRepaid) <= 0.005 ? 'cleared' : loan.status });
    if (!opts?.silent) toast({ title: hi ? '✅ चुकौती दर्ज (बही में पोस्ट)' : '✅ Repayment recorded & posted', description: `₹${totalAmt.toLocaleString('en-IN')}${interest > 0 ? ` · ${hi ? 'ब्याज' : 'interest'} ₹${interest.toLocaleString('en-IN')}` : ''}` });
    return true;
  };
  return recordRepayment;
}
