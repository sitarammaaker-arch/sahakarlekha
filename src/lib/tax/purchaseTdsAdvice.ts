/**
 * 194Q advice on a purchase bill (Phase-2 D3 — wire the TDS engine to a real transaction). PURE.
 *
 * ADVICE ONLY: it never changes the bill. It aggregates this financial year's purchases from the
 * supplier (this bill included), asks computeTds — the one deterministic, sourced engine — and splits
 * out the part of the TDS that THIS bill brings (194Q deducts on the sum EXCEEDING the threshold,
 * s.393(1) Sl. 8(ii) Note 1(b), so the TDS of a bill = TDS(after) − TDS(before)).
 *
 * What it says it does NOT know (never filled in from memory):
 *  • the buyer-turnover gate (tds.194q.applies_if.buyer_turnover_min) — recorded, UNVERIFIED;
 *  • whether GST belongs in the base — the aggregate here is the bill value WITHOUT GST, and says so.
 */
import { computeTds, isRefusal } from './computeTds';
import { fyStartOf } from '../fyPeriod';
import type { Minor } from '../money';
import type { TaxContext } from '../rules/tax';

export interface PurchaseLite { id?: string; supplierId?: string; date: string; netAmount: number; isDeleted?: boolean }

export type PurchaseTdsAdvice =
  | { kind: 'none' }                                    // not a 194Q supplier — nothing to say
  | { kind: 'refused'; reason: string }                 // the engine refused (no verified rule)
  | { kind: 'below'; aggregateMinor: Minor; thresholdMinor: Minor; explain: string; caveats: string[] }
  | { kind: 'above'; aggregateMinor: Minor; thresholdMinor: Minor; ratePct: number; billTdsMinor: Minor; billTdsPct: number; explain: string; caveats: string[] };

const toMinorR = (r: number) => Math.round((Number(r) || 0) * 100) as Minor;

export const PURCHASE_194Q_CAVEATS = [
  'क्रेता (समिति) के पिछले वर्ष के turnover वाली शर्त अभी सत्यापित नहीं — CA से पुष्टि करें।',
  'राशि बिना GST के मूल्य पर जोड़ी गई है; GST आधार में शामिल हो या नहीं, यह नियम अभी सत्यापित नहीं।',
];

export function purchaseTdsAdvice(args: {
  supplierSection?: string | null;
  supplierId?: string;
  bill: { id?: string; date: string; netAmount: number };
  purchases: readonly PurchaseLite[];
  ctx?: Omit<TaxContext, 'asOf'>;
}): PurchaseTdsAdvice {
  const section = (args.supplierSection || '').toLowerCase();
  if (section !== '194q' || !args.supplierId || !args.bill.date) return { kind: 'none' };
  const fyStart = fyStartOf(args.bill.date);
  const fyEnd = `${Number(fyStart.slice(0, 4)) + 1}-03-31`;
  const before = args.purchases
    .filter(p => !p.isDeleted && p.supplierId === args.supplierId && p.id !== args.bill.id
      && p.date >= fyStart && p.date <= fyEnd)
    .reduce((s, p) => s + toMinorR(p.netAmount), 0) as Minor;
  const after = (before + toMinorR(args.bill.netAmount)) as Minor;
  const ctx: TaxContext = { ...(args.ctx ?? {}), asOf: args.bill.date } as TaxContext;
  const a = computeTds({ section: '194q', aggregateMinor: after, ctx });
  if (isRefusal(a)) return { kind: 'refused', reason: a.reason };
  if (!a.applicable) return { kind: 'below', aggregateMinor: after, thresholdMinor: a.thresholdMinor, explain: a.explain, caveats: PURCHASE_194Q_CAVEATS };
  const b = computeTds({ section: '194q', aggregateMinor: before, ctx });
  const beforeTds = !isRefusal(b) && b.applicable ? b.tdsMinor : 0;
  const billTdsMinor = (a.tdsMinor - beforeTds) as Minor;
  const billNet = toMinorR(args.bill.netAmount);
  return {
    kind: 'above', aggregateMinor: after, thresholdMinor: a.thresholdMinor, ratePct: a.ratePct, billTdsMinor,
    billTdsPct: billNet > 0 ? Math.round((billTdsMinor / billNet) * 100 * 10000) / 10000 : 0,
    explain: a.explain, caveats: PURCHASE_194Q_CAVEATS,
  };
}
