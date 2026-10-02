/**
 * Receipts & Payments Account from voucher state — PURE (Phase K3: lifted verbatim out of
 * DataContext.getReceiptsPayments).
 *
 * DataContext still decides WHICH source serves the statement (ledgerReport: the T-09 journal projection
 * when it matches, otherwise this). This module is only the voucher-state compute, so it can be tested
 * on its own. The openings are returned in paise too, because the journal projection needs the same ones.
 */
import type { LedgerAccount, ReceiptsPaymentsData, Voucher } from '@/types';
import { getVoucherLines } from '@/lib/voucherUtils';
import { toMinor, toRupees, addMinor } from '@/lib/money';
import { ACCOUNT_IDS, getBankAccountIds, isBankAccount } from '@/lib/storage';
import { accountNature, accountGlType } from '@/lib/ledger/receiptsPaymentsClassify';

export interface ReceiptsPaymentsInput {
  accounts: LedgerAccount[];
  /** Live vouchers only (RULE 5). */
  vouchers: Voucher[];
  /** Inclusive as-of date (YYYY-MM-DD); omitted = every voucher. */
  asOnDate?: string;
  /** ECR-17: account openings belong to the Head Office scope only. */
  openingsInScope: boolean;
}

export interface ReceiptsPaymentsResult {
  data: ReceiptsPaymentsData;
  openingCashMinor: number;
  openingBankMinor: number;
  bankIds: string[];
}

export function computeReceiptsPayments({ accounts, vouchers, asOnDate, openingsInScope }: ReceiptsPaymentsInput): ReceiptsPaymentsResult {
  const cashAccount = accounts.find(a => a.id === ACCOUNT_IDS.CASH);
  const bankIds = getBankAccountIds(accounts);
  // Sign the opening by balance type (Dr = +, Cr/overdraft = −), same as closingFor below —
  // a raw openingBalance showed an overdraft opening as a positive receipt (Audit #5).
  // ECR-17: openings belong to the Head Office scope (same rule as the trial balance).
  const signedOpening = (acc?: LedgerAccount) =>
    acc && openingsInScope ? (acc.openingBalanceType === 'debit' ? acc.openingBalance : -acc.openingBalance) : 0;
  // T-02: opening + every R&P sum in exact integer paise.
  const openingCashMinor = toMinor(signedOpening(cashAccount));
  const openingBankMinor = bankIds.reduce((sum, bid) => addMinor(sum, toMinor(signedOpening(accounts.find(a => a.id === bid)))), 0);
  const openingCash = toRupees(openingCashMinor);
  const openingBank = toRupees(openingBankMinor);

  // ── Audit C-11/C-12: classify each R&P line by GL-head type and Capital/Revenue ──
  // NCDC Annexure VII: a Receipts & Payments Account must distinguish CAPITAL
  // receipts/payments (share capital, reserves, long-term loans, fixed assets,
  // investments, deposits) from REVENUE ones (trading, income, operating expenses,
  // trade debtors/creditors). Everything else defaults to Revenue.
  // Capital/Revenue + GL-head classification (NCDC Annexure VII) — extracted to a pure lib so this
  // compute and the ledger projection (projectReceiptsPayments, T-09) can never diverge (RULE 2).
  const natureOf = (accId: string): 'capital' | 'revenue' => accountNature(accounts.find(a => a.id === accId));
  const glTypeOf = (accId: string): string => accountGlType(accounts.find(a => a.id === accId));

  type RPEntry = { name: string; nameHi: string; amount: number; nature: 'capital' | 'revenue'; glType: string };
  const receiptMap: Record<string, RPEntry> = {};
  const paymentMap: Record<string, RPEntry> = {};

  // M15: Honor asOnDate so historical Day Book / Balance Sheet lookups stay accurate.
  const vouchersToUse = asOnDate ? vouchers.filter(v => v.date <= asOnDate) : vouchers;
  // BUG-02 FIX: Use getVoucherLines() to handle multi-line Expert Mode vouchers.
  // For each line touching Cash/Bank, find the "other" side accounts in the same voucher.
  vouchersToUse.forEach(v => {
    const lines = getVoucherLines(v);
    const isCashBank = (id: string) => id === ACCOUNT_IDS.CASH || isBankAccount(id, accounts);
    // Did this voucher move cash/bank IN (a Dr line) and/or OUT (a Cr line)?
    const hasCashBankDr = lines.some(l => isCashBank(l.accountId) && l.type === 'Dr');
    const hasCashBankCr = lines.some(l => isCashBank(l.accountId) && l.type === 'Cr');
    if (!hasCashBankDr && !hasCashBankCr) return; // no cash/bank movement → not an R&P voucher

    // Book each NON-cash counterparty line exactly ONCE. Previously the other side was
    // re-added per cash/bank line, so a split receipt (Dr Cash 600 / Dr Bank 400 / Cr
    // Sales 1000) booked Sales twice = 2000. A non-cash Cr with cash/bank debited is a
    // receipt source; a non-cash Dr with cash/bank credited is a payment use. A pure
    // Cash↔Bank contra has no non-cash line, so it is still correctly excluded (C-11).
    // R&P is cash-basis. A voucher's NET cash movement equals (its non-cash Cr
    // legs) − (its non-cash Dr legs), because the voucher itself balances. So book
    // EVERY non-cash Cr leg as a receipt (source of funds) and EVERY non-cash Dr leg
    // as a payment (use of funds), regardless of which side cash/bank sat on. This
    // nets compound legs correctly and keeps R&P balanced. Example — an audit fee
    // paid net of TDS (Dr Audit 10,000 / Cr Bank 9,000 / Cr TDS-Payable 1,000):
    // books Audit 10,000 payment + TDS-Payable 1,000 receipt = ₹9,000 net cash, which
    // is exactly what left the bank. The earlier `&& hasCashBankDr/Cr` conditions
    // dropped the TDS leg, overstating the payment by the TDS amount and unbalancing
    // the statement. (A pure cash↔bank contra has no non-cash leg → still excluded.)
    lines.forEach(l => {
      if (isCashBank(l.accountId)) return;
      const otherAcc = accounts.find(a => a.id === l.accountId);
      const name = otherAcc?.name || v.narration || 'Deleted Account';
      const nameHi = otherAcc?.nameHi || name;
      if (l.type === 'Cr') {
        if (!receiptMap[l.accountId]) receiptMap[l.accountId] = { name, nameHi, amount: 0, nature: natureOf(l.accountId), glType: glTypeOf(l.accountId) };
        receiptMap[l.accountId].amount = addMinor(receiptMap[l.accountId].amount, toMinor(Number(l.amount) || 0)); // paise; → rupees at return
      } else {
        if (!paymentMap[l.accountId]) paymentMap[l.accountId] = { name, nameHi, amount: 0, nature: natureOf(l.accountId), glType: glTypeOf(l.accountId) };
        paymentMap[l.accountId].amount = addMinor(paymentMap[l.accountId].amount, toMinor(Number(l.amount) || 0)); // paise; → rupees at return
      }
    });
  });

  // M15: Compute closing balances honoring asOnDate (instead of always-current getAccountBalance).
  const closingMinorFor = (accId: string): number => {
    const acc = accounts.find(a => a.id === accId);
    if (!acc) return 0;
    // ECR-17: same opening rule as signedOpening above — closing = (scoped) opening + scoped legs.
    const opening = openingsInScope
      ? (acc.openingBalanceType === 'debit' ? (Number(acc.openingBalance) || 0) : -(Number(acc.openingBalance) || 0))
      : 0;
    let balMinor = toMinor(opening);
    vouchersToUse.forEach(v => {
      getVoucherLines(v).forEach(l => {
        if (l.accountId === accId) {
          const legMinor = toMinor(Number(l.amount) || 0);
          balMinor = addMinor(balMinor, l.type === 'Dr' ? legMinor : -legMinor);
        }
      });
    });
    return balMinor;
  };
  const closingCash = toRupees(closingMinorFor(ACCOUNT_IDS.CASH));
  const closingBank = toRupees(bankIds.reduce((sum, bid) => addMinor(sum, closingMinorFor(bid)), 0));

  const fromVouchers: ReceiptsPaymentsData = {
    openingCash,
    openingBank,
    receipts: Object.entries(receiptMap).map(([id, v]) => ({ accountId: id, accountName: v.name, accountNameHi: v.nameHi || v.name, amount: toRupees(v.amount), nature: v.nature, glType: v.glType })),
    payments: Object.entries(paymentMap).map(([id, v]) => ({ accountId: id, accountName: v.name, accountNameHi: v.nameHi || v.name, amount: toRupees(v.amount), nature: v.nature, glType: v.glType })),
    closingCash,
    closingBank,
  };
  return { data: fromVouchers, openingCashMinor, openingBankMinor, bankIds };
}
