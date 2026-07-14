/**
 * Ledger reports in the APP's shapes (T-09 / ADR-0001). PURE.
 *
 * The projections (projectCashBook / projectMemberLedger / projectReceiptsPayments) speak exact paise
 * and their own row types. DataContext's readers hand back rupee-shaped `CashBookEntry[]`,
 * `BankBookEntry[]`, `MemberLedgerEntry[]` and `ReceiptsPaymentsData`. This is the ONE mapping layer
 * between the two (RULE 2) — so the cut sites in DataContext stay a two-liner and the rupee conversion
 * happens in exactly one place, at the last step, from exact minor units.
 *
 * Consumed by the read cut (each getter serves these only when they equal the voucher-computed report
 * — see reportParity) and by the ops parity check.
 */
import type { BankBookEntry, CashBookEntry, LedgerAccount, MemberLedgerEntry, ReceiptsPaymentsData } from '@/types';
import { toRupees } from '../money';
import type { LedgerEvent } from './event';
import { projectCashBook } from './cashBook';
import { projectMemberLedger } from './memberLedger';
import { projectReceiptsPayments } from './receiptsPayments';

export interface BookOpts {
  /** the cash/bank account's opening balance in exact paise, Dr-positive (Cr/overdraft is negative). */
  openingMinor: number;
  fromDate?: string;
  toDate?: string;
}

/** PURE — the journal's Cash Book in getCashBookEntries' shape (rupees at the last step). */
export function ledgerCashBookEntries(
  events: readonly LedgerEvent[],
  cashAccountId: string,
  accounts: readonly LedgerAccount[],
  opts: BookOpts,
): CashBookEntry[] {
  return projectCashBook(events, cashAccountId, accounts, opts).map((r) => ({
    id: r.id,
    date: r.date,
    voucherNo: r.voucherNo,
    particulars: r.particulars,
    type: r.type,
    amount: toRupees(r.amountMinor),
    runningBalance: toRupees(r.runningBalanceMinor),
  }));
}

/** PURE — the journal's Bank Book in getBankBookEntries' shape. Same projection; a bank row calls a
 *  Dr a `deposit` and a Cr a `withdrawal` (the cash book says receipt/payment). */
export function ledgerBankBookEntries(
  events: readonly LedgerEvent[],
  bankAccountId: string,
  accounts: readonly LedgerAccount[],
  opts: BookOpts,
): BankBookEntry[] {
  return projectCashBook(events, bankAccountId, accounts, opts).map((r) => ({
    id: r.id,
    date: r.date,
    voucherNo: r.voucherNo,
    particulars: r.particulars,
    type: r.type === 'receipt' ? 'deposit' : 'withdrawal',
    amount: toRupees(r.amountMinor),
    runningBalance: toRupees(r.runningBalanceMinor),
  }));
}

/** PURE — a member's share-capital khata in getMemberLedger's shape. The opening (member.shareCapital)
 *  and joinDate are MEMBER data, not journal data, so they are passed in. */
export function ledgerMemberLedgerEntries(
  events: readonly LedgerEvent[],
  memberId: string,
  shareCapAccountId: string,
  opts: { openingMinor: number; joinDate: string },
): MemberLedgerEntry[] {
  return projectMemberLedger(events, memberId, shareCapAccountId, opts).map((r) => ({
    id: r.id,
    date: r.date,
    voucherNo: r.voucherNo,
    particulars: r.particulars,
    credit: toRupees(r.creditMinor),
    debit: toRupees(r.debitMinor),
    balance: toRupees(r.balanceMinor),
  }));
}

/** PURE — the journal's Receipts & Payments account in getReceiptsPayments' shape. */
export function ledgerReceiptsPaymentsData(
  events: readonly LedgerEvent[],
  accounts: readonly LedgerAccount[],
  cashId: string,
  bankIds: ReadonlySet<string>,
  opts: { openingCashMinor: number; openingBankMinor: number; asOf?: string },
): ReceiptsPaymentsData {
  const rp = projectReceiptsPayments(events, accounts, cashId, bankIds, opts);
  const item = (i: (typeof rp.receipts)[number]) => ({
    accountId: i.accountId,
    accountName: i.accountName,
    accountNameHi: i.accountNameHi,
    amount: toRupees(i.amountMinor),
    nature: i.nature,
    glType: i.glType,
  });
  return {
    openingCash: toRupees(rp.openingCashMinor),
    openingBank: toRupees(rp.openingBankMinor),
    receipts: rp.receipts.map(item),
    payments: rp.payments.map(item),
    closingCash: toRupees(rp.closingCashMinor),
    closingBank: toRupees(rp.closingBankMinor),
  };
}
