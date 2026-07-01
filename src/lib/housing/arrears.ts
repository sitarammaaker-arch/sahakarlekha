/**
 * Housing — arrears: aging of outstanding maintenance dues and simple interest/penalty on
 * overdue principal (PURE). NO React / Supabase / side effects.
 *
 * Interest is idempotent WITHOUT any new column: the "already charged upto" date is derived
 * from the bill's existing interest vouchers (refType 'maintenance.interest'), so re-running the
 * same as-on date charges nothing. Simple interest on outstanding principal only (non-compounding).
 */
import type { MaintenanceBill, Voucher } from '@/types';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const MS_DAY = 86400000;

/** Whole days between two YYYY-MM-DD dates (>= 0). */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(from), b = Date.parse(to);
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.max(0, Math.floor((b - a) / MS_DAY));
}

export type AgeBucket = '0-30' | '31-60' | '61-90' | '90+';
export function ageBucket(days: number): AgeBucket {
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

/** Simple interest (₹) on principal for [from,to] at an annual %; 0 if to<=from or principal<=0. */
export function computeInterest(principal: number, from: string, to: string, annualRatePct: number): number {
  if (!(principal > 0) || !(annualRatePct > 0)) return 0;
  const days = daysBetween(from, to);
  return round2(principal * (annualRatePct / 100) * (days / 365));
}

/** The latest date interest was already charged on a bill (else the fallback / bill date). */
export function lastInterestDate(billId: string, vouchers: Voucher[], fallback: string): string {
  let d = fallback;
  for (const v of vouchers) {
    if (v.isDeleted || v.refType !== 'maintenance.interest' || v.refId !== billId) continue;
    if (v.date > d) d = v.date;
  }
  return d;
}

export interface PlannedInterest {
  billId: string;
  outstanding: number;   // principal outstanding
  fromDate: string;      // charged-upto (exclusive lower bound)
  days: number;
  amount: number;        // interest to charge for (fromDate, asOn]
}

/** Interest to charge on one bill up to `asOn`, net of interest already charged. */
export function plannedBillInterest(bill: MaintenanceBill, vouchers: Voucher[], asOn: string, annualRatePct: number): PlannedInterest {
  const outstanding = round2(Math.max(0, (bill.amount || 0) - (bill.paidAmount || 0)));
  const fromDate = lastInterestDate(bill.id, vouchers, bill.date);
  const days = daysBetween(fromDate, asOn);
  const amount = outstanding > 0 ? computeInterest(outstanding, fromDate, asOn, annualRatePct) : 0;
  return { billId: bill.id, outstanding, fromDate, days, amount };
}

export interface AgingRow {
  billId: string; billNo: string; flatNo?: string; memberId?: string; period: string;
  billDate: string; outstanding: number; days: number; bucket: AgeBucket;
}
export interface AgingRegister {
  rows: AgingRow[];
  buckets: Record<AgeBucket, number>;
  total: number;
}

/** Aging of open bills (principal outstanding > 0) as of `asOn`, bucketed by bill age. */
export function buildAgingRegister(bills: MaintenanceBill[], asOn: string): AgingRegister {
  const buckets: Record<AgeBucket, number> = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  const rows: AgingRow[] = [];
  for (const b of bills) {
    if (b.isDeleted) continue;
    const outstanding = round2((b.amount || 0) - (b.paidAmount || 0));
    if (outstanding <= 0.005) continue;
    const days = daysBetween(b.date, asOn);
    const bucket = ageBucket(days);
    buckets[bucket] = round2(buckets[bucket] + outstanding);
    rows.push({ billId: b.id, billNo: b.billNo, flatNo: b.flatNo, memberId: b.memberId, period: b.period, billDate: b.date, outstanding, days, bucket });
  }
  rows.sort((a, b) => b.days - a.days || (a.flatNo || '').localeCompare(b.flatNo || ''));
  const total = round2(rows.reduce((s, r) => s + r.outstanding, 0));
  return { rows, buckets, total };
}
