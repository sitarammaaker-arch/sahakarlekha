/**
 * Receipts & Payments account from the event journal (T-09 / ADR-0001, NCDC Annexure VII). PURE. The
 * ledger-native equivalent of DataContext.getReceiptsPayments — a cash-basis statement of receipts and
 * payments (Capital/Revenue classified) plus opening/closing cash & bank.
 *
 * For every CURRENT voucher (resolveCurrentVouchers — cancelled dropped, edited → latest reposted)
 * that moves cash/bank, each NON-cash/bank leg is booked once: a Cr is a receipt, a Dr is a payment,
 * aggregated by account. Nature/GL-head come from the SHARED classifier (receiptsPaymentsClassify) so
 * this and getReceiptsPayments cannot diverge (RULE 2). Closing = opening + the account's cash/bank
 * legs. Exact paise (T-02). NOT wired.
 */
import type { LedgerAccount } from '@/types';
import type { LedgerEvent } from './event';
import { resolveCurrentVouchers, type CurrentLeg } from './aggregateState';
import { accountNature, accountGlType } from './receiptsPaymentsClassify';

export interface RPItem {
  accountId: string;
  accountName: string;
  accountNameHi: string;
  amountMinor: number;
  nature: 'capital' | 'revenue';
  glType: string;
}

export interface RPData {
  openingCashMinor: number;
  openingBankMinor: number;
  receipts: RPItem[];
  payments: RPItem[];
  closingCashMinor: number;
  closingBankMinor: number;
}

/**
 * PURE — the R&P account. `cashId` + `bankIds` say which accounts are cash/bank; `opts.openingCashMinor`
 * / `openingBankMinor` seed the opening + closing. `opts.asOf` (inclusive) bounds it. Amounts are exact
 * minor units; the wiring converts to rupees.
 */
export function projectReceiptsPayments(
  events: readonly LedgerEvent[],
  accounts: readonly LedgerAccount[],
  cashId: string,
  bankIds: ReadonlySet<string>,
  opts: { openingCashMinor: number; openingBankMinor: number; asOf?: string },
): RPData {
  const acctById = new Map(accounts.map((a) => [a.id, a]));
  const isCashBank = (id: string) => id === cashId || bankIds.has(id);

  const current = resolveCurrentVouchers(events).filter((c) => !opts.asOf || c.date <= opts.asOf);

  const receipts = new Map<string, RPItem>();
  const payments = new Map<string, RPItem>();
  let closingCashMinor = opts.openingCashMinor;
  let closingBankMinor = opts.openingBankMinor;
  const book = (map: Map<string, RPItem>, l: CurrentLeg) => {
    const acc = acctById.get(l.accountId);
    const name = acc?.name || 'Deleted Account';
    let item = map.get(l.accountId);
    if (!item) { item = { accountId: l.accountId, accountName: name, accountNameHi: acc?.nameHi || name, amountMinor: 0, nature: accountNature(acc), glType: accountGlType(acc) }; map.set(l.accountId, item); }
    item.amountMinor += l.amountMinor;
  };
  for (const v of current) {
    if (!v.legs.some((l) => isCashBank(l.accountId))) continue; // not a cash/bank voucher
    for (const l of v.legs) {
      if (l.accountId === cashId) closingCashMinor += l.drCr === 'Dr' ? l.amountMinor : -l.amountMinor;
      else if (bankIds.has(l.accountId)) closingBankMinor += l.drCr === 'Dr' ? l.amountMinor : -l.amountMinor;
      else if (l.drCr === 'Cr') book(receipts, l); // non-cash Cr → a receipt (source of cash)
      else book(payments, l);                      // non-cash Dr → a payment (use of cash)
    }
  }

  return {
    openingCashMinor: opts.openingCashMinor,
    openingBankMinor: opts.openingBankMinor,
    receipts: [...receipts.values()],
    payments: [...payments.values()],
    closingCashMinor,
    closingBankMinor,
  };
}
