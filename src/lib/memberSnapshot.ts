/**
 * Member snapshot — the PURE per-member calculations shared by the staff pages and the member
 * portal (Member Portal S0). One formula per figure (RULE 2): the staff view and the member's own
 * view must never disagree, so both call these functions instead of computing inline.
 *
 * - buildMemberShareLedger: the voucher-path share-capital khata, moved verbatim out of
 *   DataContext.getMemberLedger (the journal path is projectMemberLedger in lib/ledger).
 * - loanOutstanding / kccOutstanding: the single outstanding formula for a loan / KCC loan.
 *
 * Callers pass ACTIVE vouchers (RULE 5: isDeleted already filtered out).
 */
import type { Member, MemberLedgerEntry, Voucher, Loan, KccLoan } from '@/types';
import { toMinor, toRupees, addMinor } from './money';

/**
 * PURE — a member's share-capital ledger from active vouchers. Only vouchers tagged with this member
 * and touching the share-capital account are included (admission fee etc. are excluded). When the
 * member has no share-capital credit voucher, the member.shareCapital scalar is shown as an OB row
 * (backward compatibility for members imported without a voucher). Running balance in integer paise.
 */
export function buildMemberShareLedger(
  member: Pick<Member, 'id' | 'shareCapital' | 'joinDate'>,
  activeVouchers: readonly Voucher[],
  shareCapAccountId: string,
): MemberLedgerEntry[] {
  const memberVouchers = activeVouchers
    .filter(v => v.memberId === member.id && (v.creditAccountId === shareCapAccountId || v.debitAccountId === shareCapAccountId))
    // Deterministic tie-break — same key as projectMemberLedger.
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || (a.voucherNo || '').localeCompare(b.voucherNo || '') || a.id.localeCompare(b.id));

  const hasShareCapVoucher = memberVouchers.some(v => v.creditAccountId === shareCapAccountId);
  // If a proper voucher exists, start at 0 (voucher covers it). Otherwise show OB row.
  let balanceMinor = toMinor(hasShareCapVoucher ? 0 : (member.shareCapital || 0));
  const result: MemberLedgerEntry[] = [];

  if (!hasShareCapVoucher && (member.shareCapital || 0) > 0) {
    result.push({
      id: 'ob',
      date: member.joinDate,
      voucherNo: 'OB',
      particulars: 'Opening Share Capital',
      credit: member.shareCapital,
      debit: 0,
      balance: toRupees(balanceMinor),
    });
  }

  for (const v of memberVouchers) {
    const isCredit = v.creditAccountId === shareCapAccountId;
    const credit = isCredit ? v.amount : 0;
    const debit = !isCredit ? v.amount : 0;
    balanceMinor = addMinor(balanceMinor, toMinor(credit), -toMinor(debit));
    result.push({
      id: v.id,
      date: v.date,
      voucherNo: v.voucherNo,
      particulars: v.narration || (isCredit ? 'Share deposit received' : 'Share withdrawal'),
      credit,
      debit,
      balance: toRupees(balanceMinor),
    });
  }
  return result;
}

/** PURE — a loan's outstanding principal: sanctioned amount minus principal repaid. */
export function loanOutstanding(loan: Pick<Loan, 'amount' | 'repaidAmount'>): number {
  return loan.amount - loan.repaidAmount;
}

/** PURE — a KCC loan's outstanding: the stored figure when present, else drawn minus repaid. */
export function kccOutstanding(loan: Pick<KccLoan, 'outstandingAmount' | 'drawnAmount' | 'repaidAmount'>): number {
  return loan.outstandingAmount ?? (loan.drawnAmount - loan.repaidAmount);
}
