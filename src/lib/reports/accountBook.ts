/**
 * Cash Book and Bank Book from voucher state — PURE (Phase K4: lifted out of DataContext.getCashBookEntries
 * / getBankBookEntries, which were the same compute twice with a different account id and row labels).
 *
 * DataContext still decides WHICH source serves the book (ledgerReport: the T-09 journal projection when
 * it matches, otherwise this). The opening is returned in paise too, because the projection needs it.
 *
 * T-02: the running balance accumulates in exact integer paise (RULE 2), rupees only at each emitted row.
 * ECR-17: the account opening belongs to the Head Office scope (same rule as the trial balance).
 */
import type { BankBookEntry, CashBookEntry, LedgerAccount, Voucher } from '@/types';
import { getVoucherLines } from '@/lib/voucherUtils';
import { toMinor, toRupees, addMinor } from '@/lib/money';

export interface AccountBookInput {
  accounts: LedgerAccount[];
  /** Live vouchers only (RULE 5). */
  vouchers: Voucher[];
  /** The cash or bank account the book is for. */
  accountId: string;
  fromDate?: string;
  toDate?: string;
  openingsInScope: boolean;
}

interface BookRow<T extends string> { id: string; date: string; voucherNo: string; particulars: string; type: T; amount: number; runningBalance: number }

/** null when the account does not exist (the caller shows an empty book). */
function computeAccountBook<T extends string>(
  { accounts, vouchers, accountId, fromDate, toDate, openingsInScope }: AccountBookInput,
  inType: T, outType: T,
): { entries: BookRow<T>[]; openingMinor: number } | null {
  const account = accounts.find(a => a.id === accountId);
  if (!account) return null;
  const openingMinor = openingsInScope
    ? toMinor(account.openingBalanceType === 'debit' ? account.openingBalance : -account.openingBalance)
    : 0;
  let runningBalanceMinor = openingMinor;

  const bookVouchers = vouchers
    .filter(v => getVoucherLines(v).some(l => l.accountId === accountId))
    // Deterministic tie-break so same-date + same-createdAt vouchers sort the SAME way here as in the
    // ledger projection (projectCashBook, which serves the bank book too), else the running balance —
    // and book parity — diverge.
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || (a.voucherNo || '').localeCompare(b.voucherNo || '') || a.id.localeCompare(b.id));

  if (fromDate) {
    bookVouchers.filter(v => v.date < fromDate).forEach(v => {
      getVoucherLines(v).filter(l => l.accountId === accountId).forEach(l => {
        runningBalanceMinor = addMinor(runningBalanceMinor, l.type === 'Dr' ? toMinor(l.amount) : -toMinor(l.amount));
      });
    });
  }

  const entries: BookRow<T>[] = [];
  bookVouchers
    .filter(v => {
      if (fromDate && v.date < fromDate) return false;
      if (toDate && v.date > toDate) return false;
      return true;
    })
    .forEach(v => {
      const bookLines = getVoucherLines(v).filter(l => l.accountId === accountId);
      bookLines.forEach(l => {
        runningBalanceMinor = addMinor(runningBalanceMinor, l.type === 'Dr' ? toMinor(l.amount) : -toMinor(l.amount));
        const otherLines = getVoucherLines(v).filter(ol => ol.accountId !== accountId);
        const otherAcc = accounts.find(a => a.id === otherLines[0]?.accountId);
        entries.push({
          id: v.id,
          date: v.date,
          voucherNo: v.voucherNo,
          particulars: v.narration || otherAcc?.name || '',
          type: l.type === 'Dr' ? inType : outType,
          amount: l.amount,
          runningBalance: toRupees(runningBalanceMinor),
        });
      });
    });
  return { entries, openingMinor };
}

export function computeCashBook(input: AccountBookInput): { entries: CashBookEntry[]; openingMinor: number } | null {
  return computeAccountBook<CashBookEntry['type']>(input, 'receipt', 'payment');
}

export function computeBankBook(input: AccountBookInput): { entries: BankBookEntry[]; openingMinor: number } | null {
  return computeAccountBook<BankBookEntry['type']>(input, 'deposit', 'withdrawal');
}
