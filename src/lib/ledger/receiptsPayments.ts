/**
 * Receipts & Payments account from the event journal (T-09 / ADR-0001, NCDC Annexure VII). PURE. The
 * ledger-native equivalent of DataContext.getReceiptsPayments — a cash-basis statement of receipts and
 * payments (Capital/Revenue classified) plus opening/closing cash & bank.
 *
 * For every CURRENT voucher (aggregate resolved: cancelled excluded, edited → latest reposted, else
 * posted) that moves cash/bank, each NON-cash/bank leg is booked once: a Cr is a receipt, a Dr is a
 * payment, aggregated by account. Nature/GL-head come from the SHARED classifier
 * (receiptsPaymentsClassify) so this and getReceiptsPayments cannot diverge (RULE 2). Closing = opening
 * + the account's cash/bank legs. Exact paise (T-02). NOT wired.
 */
import type { LedgerAccount } from '@/types';
import type { LedgerEvent } from './event';
import { isValidMinor } from '../money';
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

interface Leg { accountId: string; drCr: 'Dr' | 'Cr'; amountMinor: number; }

function legsOf(payload: unknown): Leg[] {
  if (!payload || typeof payload !== 'object') return [];
  const arr = (payload as { lines?: unknown }).lines;
  if (!Array.isArray(arr)) return [];
  const out: Leg[] = [];
  for (const l of arr) {
    if (l && typeof l === 'object'
      && typeof (l as Leg).accountId === 'string'
      && ((l as Leg).drCr === 'Dr' || (l as Leg).drCr === 'Cr')
      && isValidMinor((l as Leg).amountMinor)) {
      out.push({ accountId: (l as Leg).accountId, drCr: (l as Leg).drCr, amountMinor: (l as Leg).amountMinor });
    }
  }
  return out;
}
const str = (p: unknown, k: string): string => {
  const v = p && typeof p === 'object' ? (p as Record<string, unknown>)[k] : undefined;
  return typeof v === 'string' ? v : '';
};

/**
 * PURE — the R&P account. `cashId` + `bankIds` say which accounts are cash/bank; `opts.openingCashMinor`
 * / `openingBankMinor` seed the opening + closing (member/account data, not in the journal). `opts.asOf`
 * (inclusive) bounds it. Amounts are exact minor units; the wiring converts to rupees.
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

  // 1. Resolve each aggregate to its current effective event's legs (+ date), within asOf.
  const byAgg = new Map<string, LedgerEvent[]>();
  for (const e of Array.isArray(events) ? events : []) {
    if (e.aggregateType !== 'voucher') continue;
    (byAgg.get(e.aggregateId) ?? byAgg.set(e.aggregateId, []).get(e.aggregateId)).push(e);
  }
  const current: { date: string; narration: string; legs: Leg[] }[] = [];
  for (const [, evs] of byAgg) {
    if (evs.some((e) => e.eventType === 'voucher.cancelled')) continue;
    const reposted = evs.filter((e) => e.eventType === 'voucher.reposted');
    const ev = reposted.length ? reposted[reposted.length - 1] : evs.find((e) => e.eventType === 'voucher.posted');
    if (!ev) continue;
    const date = str(ev.payload, 'date') || ev.occurredAt.slice(0, 10);
    if (opts.asOf && date > opts.asOf) continue;
    current.push({ date, narration: str(ev.payload, 'narration'), legs: legsOf(ev.payload) });
  }

  // 2. Book receipts/payments + accumulate closing cash/bank.
  const receipts = new Map<string, RPItem>();
  const payments = new Map<string, RPItem>();
  let closingCashMinor = opts.openingCashMinor;
  let closingBankMinor = opts.openingBankMinor;
  const book = (map: Map<string, RPItem>, l: Leg) => {
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
      else if (l.drCr === 'Cr') book(receipts, l);   // non-cash Cr → a receipt (source of cash)
      else book(payments, l);                        // non-cash Dr → a payment (use of cash)
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
