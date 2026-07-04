/**
 * Consumer C5 — read-only register builders (pure, tested). No new state; these aggregate
 * existing sales + member-credit data for the counter Z-report and the outstanding register.
 */
import { memberOutstanding, memberAgeing, type Ageing, type CreditSaleRow, type RecoveryRow } from './credit';

const saleValue = (s: { grandTotal?: number; netAmount?: number }): number =>
  typeof s.grandTotal === 'number' && s.grandTotal > 0 ? s.grandTotal : (s.netAmount || 0);

export type Tender = 'cash' | 'bank' | 'credit';
export interface CounterSummary {
  count: number;
  total: number;
  tenders: Record<Tender, { amount: number; count: number }>;
}

/** Counter Z-report for [from,to]: total + per-tender (cash/bank/credit) split. */
export function buildCounterSummary(
  sales: ReadonlyArray<{ paymentMode: string; grandTotal?: number; netAmount?: number; date: string }>,
  from: string,
  to: string,
): CounterSummary {
  const tenders: Record<Tender, { amount: number; count: number }> = {
    cash: { amount: 0, count: 0 }, bank: { amount: 0, count: 0 }, credit: { amount: 0, count: 0 },
  };
  let count = 0, total = 0;
  for (const s of sales) {
    if (s.date < from || s.date > to) continue;
    const v = saleValue(s);
    const t = (s.paymentMode === 'cash' || s.paymentMode === 'bank' || s.paymentMode === 'credit') ? s.paymentMode as Tender : 'cash';
    tenders[t].amount = Math.round((tenders[t].amount + v) * 100) / 100;
    tenders[t].count += 1;
    total = Math.round((total + v) * 100) / 100;
    count += 1;
  }
  return { count, total, tenders };
}

export interface OutstandingRow { memberId: string; memberName: string; outstanding: number; ageing: Ageing; }
export interface OutstandingRegister { rows: OutstandingRow[]; totalOutstanding: number; totalAgeing: Ageing; }

/** Members with store-credit outstanding > 0, each with FIFO ageing; sorted by outstanding desc. */
export function buildOutstandingRegister(
  members: ReadonlyArray<{ id: string; name: string; status?: string }>,
  sales: ReadonlyArray<CreditSaleRow>,
  recoveries: ReadonlyArray<RecoveryRow>,
  asOf: string,
): OutstandingRegister {
  const rows: OutstandingRow[] = [];
  const totalAgeing: Ageing = { b0_30: 0, b31_60: 0, b61_90: 0, b90plus: 0, total: 0 };
  for (const m of members) {
    const outstanding = memberOutstanding(sales, recoveries, m.id);
    if (outstanding <= 0) continue;
    const ageing = memberAgeing(sales, recoveries, m.id, asOf);
    rows.push({ memberId: m.id, memberName: m.name, outstanding, ageing });
    totalAgeing.b0_30 += ageing.b0_30; totalAgeing.b31_60 += ageing.b31_60;
    totalAgeing.b61_90 += ageing.b61_90; totalAgeing.b90plus += ageing.b90plus; totalAgeing.total += ageing.total;
  }
  rows.sort((a, b) => b.outstanding - a.outstanding);
  const round = (n: number) => Math.round(n * 100) / 100;
  totalAgeing.b0_30 = round(totalAgeing.b0_30); totalAgeing.b31_60 = round(totalAgeing.b31_60);
  totalAgeing.b61_90 = round(totalAgeing.b61_90); totalAgeing.b90plus = round(totalAgeing.b90plus); totalAgeing.total = round(totalAgeing.total);
  return { rows, totalOutstanding: round(rows.reduce((s, r) => s + r.outstanding, 0)), totalAgeing };
}
