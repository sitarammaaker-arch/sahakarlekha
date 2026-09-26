/**
 * Member Portal S3 — turns the member_portal_snapshot() payload (064) into what the member sees.
 * PURE. Every figure goes through the SAME functions the staff pages use (lib/memberSnapshot — S0),
 * so the member's own view can never disagree with the society's books (RULE 2).
 */
import type { Member, Voucher, Loan, KccLoan, MemberLedgerEntry } from '@/types';
import { buildMemberShareLedger, loanOutstanding, kccOutstanding } from './memberSnapshot';
import { toMinor, toRupees, addMinor } from './money';
import { loanInterestDue, type LoanInterestAccrual } from './loans/interestAccrual';

export const SHARE_CAP_ACCOUNT_ID = '1102';

export interface PortalSnapshot {
  ok: true;
  society: { name?: string | null; nameHi?: string | null; address?: string | null } | null;
  member: {
    id: string; memberId: string; name: string; fatherName?: string | null; address?: string | null;
    phone?: string | null; memberType?: string | null; joinDate: string; status: string;
    shareCapital: number | null; shareCount?: number | null; shareFaceValue?: number | null; shareCertNo?: string | null;
    nomineeName?: string | null; nomineeRelation?: string | null;
    nominees?: { name?: string; relation?: string; sharePct?: number }[];
    kycStatus?: string | null; aadhaarMasked?: string | null; panMasked?: string | null;
  };
  shareVouchers: Voucher[];
  loans: (Pick<Loan, 'id' | 'loanNo' | 'loanType' | 'purpose' | 'amount' | 'interestRate' | 'disbursementDate' | 'dueDate' | 'repaidAmount' | 'status'>)[];
  deposits: { id: string; accountNo: string; depositType: string; openDate: string; balance: number; interestRate?: number | null; maturityDate?: string | null; installmentAmount?: number | null; status: string }[];
  depositTransactions: { id: string; depositAccountId: string; date: string; txnType: string; amount: number; balanceAfter: number }[];
  kccLoans: (Pick<KccLoan, 'id' | 'loanNo' | 'cropName' | 'cropSeason' | 'sanctionedAmount' | 'drawnAmount' | 'repaidAmount' | 'outstandingAmount' | 'interestRate' | 'disbursementDate' | 'dueDate' | 'status'>)[];
  /** 069 accrual rows of THIS member's loans / KCC (070). Absent on older payloads ⇒ no interest shown. */
  loanAccruals?: { id: string; loanId: string; amount: number; overdue: boolean; voucherId?: string | null; isDeleted?: boolean }[];
  /** The vouchers the due rule reads: this member's accrual journals (id only — society-level), and
   *  the live repayment / reserve-release vouchers of this member's loans. */
  loanInterestVouchers?: { id: string; isDeleted?: boolean; refType?: string; refId?: string; debitAccountId?: string; creditAccountId?: string; amount: number; lines?: { accountId: string; type: 'Dr' | 'Cr'; amount: number }[] }[];
}

export type PortalDenied = { ok: false; reason: 'no_access' | 'member_inactive' | 'plan_unavailable' | string };

export interface PortalView {
  shareLedger: MemberLedgerEntry[];
  shareBalance: number;
  loans: (PortalSnapshot['loans'][number] & { outstanding: number; interestDue: number; interestOverdue: number })[];
  loanOutstandingTotal: number;
  /** Accrued interest not yet received, over all this member's loans + KCC (same rule as Loan Register). */
  interestDueTotal: number;
  deposits: (PortalSnapshot['deposits'][number] & { transactions: PortalSnapshot['depositTransactions'] })[];
  depositTotal: number;
  kccLoans: (PortalSnapshot['kccLoans'][number] & { outstanding: number; interestDue: number; interestOverdue: number })[];
  kccOutstandingTotal: number;
}

const num = (n: unknown) => Number(n) || 0;
const sumRupees = (values: number[]) => toRupees(addMinor(...values.map((v) => toMinor(v))));

export function buildPortalView(s: PortalSnapshot): PortalView {
  const m = s.member;
  const vouchers = (s.shareVouchers ?? []).map((v) => ({ ...v, amount: num(v.amount) }));
  const shareLedger = buildMemberShareLedger(
    { id: m.id, shareCapital: num(m.shareCapital), joinDate: m.joinDate },
    vouchers,
    SHARE_CAP_ACCOUNT_ID,
  );
  // Same fallback as getMemberShareReconciliation: no ledger rows ⇒ the member's share-capital scalar.
  const shareBalance = shareLedger.length ? shareLedger[shareLedger.length - 1].balance : num(m.shareCapital);

  // Accrued interest per loan — the SAME loanInterestDue the Loan Register / KCC repay dialog use.
  const accruals = (s.loanAccruals ?? []).map((a) => ({ ...a, amount: num(a.amount) })) as unknown as LoanInterestAccrual[];
  const ivs = (s.loanInterestVouchers ?? []).map((v) => ({
    ...v, amount: num(v.amount), lines: (v.lines ?? []).map((l) => ({ ...l, amount: num(l.amount) })),
  }));
  const dueOf = (loanId: string) => {
    const d = loanInterestDue(loanId, accruals, ivs);
    return { interestDue: d.receivable, interestOverdue: Math.min(d.reserve, d.receivable) };
  };

  const loans = (s.loans ?? []).map((l) => {
    const loan = { ...l, amount: num(l.amount), repaidAmount: num(l.repaidAmount) };
    return { ...loan, outstanding: loanOutstanding(loan), ...dueOf(l.id) };
  });
  // Same scope as the Dashboard / Loan Register total: cleared loans do not count.
  const loanOutstandingTotal = sumRupees(loans.filter((l) => l.status !== 'cleared').map((l) => l.outstanding));

  const txns = s.depositTransactions ?? [];
  const deposits = (s.deposits ?? []).map((d) => ({
    ...d, balance: num(d.balance), transactions: txns.filter((t) => t.depositAccountId === d.id),
  }));
  const depositTotal = sumRupees(deposits.filter((d) => d.status !== 'closed').map((d) => d.balance));

  const kccLoans = (s.kccLoans ?? []).map((k) => {
    const loan = {
      ...k, drawnAmount: num(k.drawnAmount), repaidAmount: num(k.repaidAmount),
      outstandingAmount: k.outstandingAmount == null ? k.outstandingAmount : num(k.outstandingAmount),
    };
    return { ...loan, outstanding: kccOutstanding(loan), ...dueOf(k.id) };
  });
  // Same scope as the NABARD / Federation reports: fully repaid KCC loans do not count.
  const kccOutstandingTotal = sumRupees(kccLoans.filter((k) => k.status !== 'repaid').map((k) => k.outstanding));

  const interestDueTotal = sumRupees([...loans, ...kccLoans].map((l) => l.interestDue));

  return { shareLedger, shareBalance, loans, loanOutstandingTotal, interestDueTotal, deposits, depositTotal, kccLoans, kccOutstandingTotal };
}

/** Hindi-first message for each server refusal. */
export function deniedMessage(reason: string, hi: boolean): string {
  switch (reason) {
    case 'member_inactive': return hi ? 'आपकी सदस्यता अभी सक्रिय नहीं है। समिति से संपर्क करें।' : 'Your membership is not active. Please contact the society.';
    case 'plan_unavailable': return hi ? 'यह सेवा अस्थायी रूप से उपलब्ध नहीं है। समिति से संपर्क करें।' : 'This service is temporarily unavailable. Please contact the society.';
    default: return hi ? 'आपका login बंद है या मान्य नहीं है। समिति से संपर्क करें।' : 'Your login is closed or not valid. Please contact the society.';
  }
}
