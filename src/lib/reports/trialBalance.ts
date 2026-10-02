/**
 * Trial balance from voucher state — PURE (Phase K1: lifted verbatim out of DataContext.getTrialBalance).
 *
 * DataContext still decides WHICH source serves the trial balance (the T-09 ledger read when the journal
 * matches, otherwise this). This module is only the voucher-state compute, so it can be tested on its own.
 *
 * Phase-2 C (D1, one continuous ledger): the opening columns are the balance brought forward at the start
 * of the as-of date's financial year — earlier years' vouchers fold into it — and the transaction columns
 * hold only that year. Net balances are unchanged; a society whose vouchers all sit in one year sees
 * exactly the old columns.
 *
 * T-02 (money precision / ADR-0006): every leg is summed in exact integer paise, so a trial balance over
 * thousands of legs cannot drift in the last paisa the way float accumulation does (RULE 2 / CA-02).
 * Storage stays rupees; only this COMPUTE is minor-unit.
 */
import type { AccountBalance, LedgerAccount, Voucher } from '@/types';
import { getVoucherLines } from '@/lib/voucherUtils';
import { toMinor, toRupees, addMinor, subMinor, type Minor } from '@/lib/money';
import { netOpening } from '@/lib/fyPeriod';

export interface TrialBalanceInput {
  accounts: LedgerAccount[];
  /** Live vouchers only — the caller filters out soft-deleted ones (RULE 5). */
  vouchers: Voucher[];
  /** Inclusive as-of date (YYYY-MM-DD); omitted = every voucher. */
  asOnDate?: string;
  /** Start of the reporting FY; vouchers before it fold into the opening columns. Omitted = no fold. */
  fyStart?: string | null;
  /** ECR-17: account openings belong to the Head Office scope only. */
  openingsInScope: boolean;
}

export function computeTrialBalance({ accounts, vouchers, asOnDate, fyStart, openingsInScope }: TrialBalanceInput): AccountBalance[] {
  const vouchersToUse = asOnDate ? vouchers.filter(v => v.date <= asOnDate) : vouchers;
  const accountIds = new Set(accounts.filter(a => !a.isGroup).map(a => a.id));

  // Single pass over vouchers×lines: accumulate Dr/Cr per accountId ONCE — O(vouchers×lines + accounts).
  // addMinor is exact integer paise and order-independent; known and orphan legs land in the same map.
  const txnByAccount = new Map<string, { dr: Minor; cr: Minor }>();
  const priorByAccount = new Map<string, { dr: Minor; cr: Minor }>();   // earlier FYs → brought forward
  vouchersToUse.forEach(v => {
    const target = fyStart && v.date < fyStart ? priorByAccount : txnByAccount;
    getVoucherLines(v).forEach(l => {
      let bucket = target.get(l.accountId);
      if (!bucket) { bucket = { dr: 0, cr: 0 }; target.set(l.accountId, bucket); }
      if (l.type === 'Dr') bucket.dr = addMinor(bucket.dr, toMinor(Number(l.amount) || 0));
      else bucket.cr = addMinor(bucket.cr, toMinor(Number(l.amount) || 0));
    });
  });

  const results: AccountBalance[] = accounts.filter(a => !a.isGroup).map(account => {
    const staticDr = openingsInScope && account.openingBalanceType === 'debit' ? toMinor(Number(account.openingBalance) || 0) : 0;
    const staticCr = openingsInScope && account.openingBalanceType === 'credit' ? toMinor(Number(account.openingBalance) || 0) : 0;
    const prior = priorByAccount.get(account.id);
    // No earlier-year vouchers → the static opening exactly as before; otherwise one NET b/f figure.
    const { drMinor: openingDebitMinor, crMinor: openingCreditMinor } = prior
      ? netOpening(addMinor(staticDr, prior.dr), addMinor(staticCr, prior.cr))
      : { drMinor: staticDr, crMinor: staticCr };
    const txn = txnByAccount.get(account.id);
    const txnDebitMinor: Minor = txn ? txn.dr : 0;
    const txnCreditMinor: Minor = txn ? txn.cr : 0;
    const totalDebitMinor = addMinor(openingDebitMinor, txnDebitMinor);
    const totalCreditMinor = addMinor(openingCreditMinor, txnCreditMinor);
    return {
      account,
      openingDebit: toRupees(openingDebitMinor),
      openingCredit: toRupees(openingCreditMinor),
      transactionDebit: toRupees(txnDebitMinor),
      transactionCredit: toRupees(txnCreditMinor),
      totalDebit: toRupees(totalDebitMinor),
      totalCredit: toRupees(totalCreditMinor),
      netBalance: toRupees(subMinor(totalDebitMinor, totalCreditMinor)),
    };
  });

  // Orphaned transactions (legs referencing deleted/missing accounts) become synthetic rows so the TB
  // still balances (earlier-year legs as a net b/f).
  const orphanIds = new Set<string>();
  txnByAccount.forEach((_b, id) => { if (!accountIds.has(id)) orphanIds.add(id); });
  priorByAccount.forEach((_b, id) => { if (!accountIds.has(id)) orphanIds.add(id); });
  orphanIds.forEach((id) => {
    const t = txnByAccount.get(id) ?? { dr: 0, cr: 0 };
    const p = priorByAccount.get(id);
    const o = p ? netOpening(p.dr, p.cr) : { drMinor: 0, crMinor: 0 };
    const syntheticAccount: LedgerAccount = {
      id, name: `[Deleted] ${id.slice(0, 8)}...`, nameHi: `[हटाया] ${id.slice(0, 8)}...`,
      type: 'liability', openingBalance: 0, openingBalanceType: 'credit',
    };
    const totDr = addMinor(o.drMinor, t.dr), totCr = addMinor(o.crMinor, t.cr);
    results.push({ account: syntheticAccount, openingDebit: toRupees(o.drMinor), openingCredit: toRupees(o.crMinor), transactionDebit: toRupees(t.dr), transactionCredit: toRupees(t.cr), totalDebit: toRupees(totDr), totalCredit: toRupees(totCr), netBalance: toRupees(subMinor(totDr, totCr)) });
  });

  return results;
}
