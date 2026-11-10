/**
 * Credit terms and the late-payment charge (विलंब शुल्क) on a credit bill. PURE.
 *
 * A credit bill carries its own terms from the day it is made: creditDays, dueDate and the rule that applied
 * then (lateFeeRule). Changing the society's or the party's rule later never touches an existing bill, and a
 * bill with no rule on it (every bill made before this feature) never gets a charge.
 *
 * This module only CALCULATES. Nothing here posts a voucher; the amount is not in any ledger.
 * Payments are the same 'against' bill allocations that decide a bill's balance (lib/billUtils, RULE 2).
 *
 * The charge starts after dueDate + graceDays, on the balance unpaid each day:
 *   percent  — simple interest at rate % a year, on the society's day count. Never compounding.
 *   flat     — rate rupees once, if anything is unpaid when the charge starts.
 *   perDay   — rate rupees for every late day.
 *   perMonth — rate rupees for every 30 late days or part of them.
 * A payment made on a day counts that day as late; the next day is charged on the smaller balance.
 */
import { allocBillId, allocMethod } from '@/lib/billUtils';
import { DEFAULT_DAY_COUNT, periodInterest, type DayCountBasis } from '@/lib/interestDayCount';
import type { BillAllocation, LateFeeRule, LateFeeType } from '@/types';

const DAY = 86_400_000;
const EPS = 0.005;
const round2 = (n: number) => Math.round(n * 100) / 100;
const utc = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const isDate = (iso: unknown): iso is string => typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso);
const daysBetween = (from: string, to: string) => Math.round((utc(to) - utc(from)) / DAY);

export function addDays(iso: string, days: number): string {
  return new Date(utc(iso) + days * DAY).toISOString().slice(0, 10);
}

/** A rule that can charge something. 'none', a zero rate and a damaged row all mean no charge. */
export function isActiveRule(rule: LateFeeRule | null | undefined): rule is LateFeeRule {
  return !!rule && rule.type !== 'none' && Number(rule.rate) > 0;
}

/** The party's own rule wins (type 'none' = this party is exempt), else the society's rule for this side. */
export function resolveLateFeeRule(
  partyRule: LateFeeRule | null | undefined,
  societyRule: LateFeeRule | null | undefined,
): LateFeeRule | undefined {
  const rule = partyRule ?? societyRule;
  return isActiveRule(rule) ? rule : undefined;
}

export interface BillTerms {
  creditDays: number | null;
  dueDate: string | null;
  lateFeeRule: LateFeeRule | null;
}

/**
 * The terms to store on a bill being saved.
 *  - creditDays undefined = the caller did not say (POS, imports): use the party's default. null / 0 = none.
 *  - not a credit bill: everything is cleared.
 *  - no credit days: no due date, so no charge either.
 *  - editing keeps the rule frozen on the bill; a bill that was already credit and had no rule never gains one.
 */
export function billTerms(input: {
  paymentMode: string;
  date: string;
  creditDays?: number | null;
  partyCreditDays?: number | null;
  rule?: LateFeeRule;
  original?: { paymentMode: string; lateFeeRule?: LateFeeRule | null };
}): BillTerms {
  const none: BillTerms = { creditDays: null, dueDate: null, lateFeeRule: null };
  if (input.paymentMode !== 'credit' || !isDate(input.date)) return none;
  const days = Math.floor(Number(input.creditDays === undefined ? input.partyCreditDays : input.creditDays) || 0);
  if (days <= 0) return none;
  let rule: LateFeeRule | null = input.rule ?? null;
  if (input.original?.paymentMode === 'credit') rule = input.original.lateFeeRule ?? null;
  return { creditDays: days, dueDate: addDays(input.date, days), lateFeeRule: rule };
}

/** Days past the due date on asOf. 0 when not yet due or no due date. */
export function daysOverdue(dueDate: string | null | undefined, asOf: string): number {
  if (!isDate(dueDate) || !isDate(asOf)) return 0;
  return Math.max(0, daysBetween(dueDate, asOf));
}

export interface BillPayment { date: string; amount: number; }

/** billId → its dated payments, from the same allocations getBillSettledMap sums. */
export function billPaymentsMap(
  vouchers: readonly { date: string; isDeleted?: boolean; billAllocations?: BillAllocation[] }[],
): Record<string, BillPayment[]> {
  const map: Record<string, BillPayment[]> = {};
  for (const v of vouchers) {
    if (v.isDeleted || !v.billAllocations) continue;
    for (const a of v.billAllocations) {
      if (allocMethod(a) !== 'against') continue;
      const id = allocBillId(a);
      if (!id) continue;
      (map[id] ||= []).push({ date: v.date, amount: a.amount || 0 });
    }
  }
  return map;
}

/**
 * A return adjusted against the party's account ('credit-adjust') lowers what is owed from its date, so the
 * charge stops running on that part. A return refunded in cash or by bank does not: the bill stays owed.
 */
export function withAdjustedReturns(
  payments: Record<string, BillPayment[]>,
  returns: readonly { billId?: string; date: string; grandTotal?: number; refundMode?: string; isDeleted?: boolean }[],
): Record<string, BillPayment[]> {
  const map: Record<string, BillPayment[]> = { ...payments };
  for (const r of returns) {
    if (r.isDeleted || r.refundMode !== 'credit-adjust' || !r.billId) continue;
    map[r.billId] = [...(map[r.billId] ?? []), { date: r.date, amount: Number(r.grandTotal) || 0 }];
  }
  return map;
}

export interface LateFeeResult {
  amount: number;
  /** Charged days: from the day after dueDate + grace to the day it was cleared, or asOf. */
  lateDays: number;
  /** Unpaid on asOf. */
  balance: number;
}

const NO_FEE = (balance: number): LateFeeResult => ({ amount: 0, lateDays: 0, balance: round2(Math.max(balance, 0)) });

export function computeLateFee(input: {
  total: number;
  dueDate?: string | null;
  rule?: LateFeeRule | null;
  payments: readonly BillPayment[];
  asOf: string;
  basis?: DayCountBasis;
}): LateFeeResult {
  const { total, dueDate, rule, asOf, basis = DEFAULT_DAY_COUNT } = input;
  const payments = input.payments
    .filter((p) => isDate(p.date) && p.amount > 0 && utc(p.date) <= utc(asOf))
    .slice()
    .sort((a, b) => utc(a.date) - utc(b.date));
  const balanceOnAsOf = (Number(total) || 0) - payments.reduce((s, p) => s + p.amount, 0);
  if (!isActiveRule(rule) || !isDate(dueDate) || !isDate(asOf)) return NO_FEE(balanceOnAsOf);

  const start = addDays(dueDate, Math.max(0, Math.floor(Number(rule.graceDays) || 0)));
  if (utc(asOf) <= utc(start)) return NO_FEE(balanceOnAsOf);

  let balance = Number(total) || 0;
  let cursor = start;
  let lateDays = 0;
  let interest = 0;
  const charge = (to: string) => {
    if (balance <= EPS) return;
    const days = daysBetween(cursor, to);
    if (days <= 0) return;
    lateDays += days;
    if (rule.type === 'percent') interest += periodInterest(balance, rule.rate, to, days, basis);
  };
  for (const p of payments) {
    if (utc(p.date) > utc(cursor)) {
      charge(p.date);
      cursor = p.date;
    }
    balance -= p.amount;
  }
  charge(asOf);
  if (lateDays === 0) return NO_FEE(balanceOnAsOf);

  const amounts: Record<Exclude<LateFeeType, 'none'>, number> = {
    percent: interest,
    flat: rule.rate,
    perDay: rule.rate * lateDays,
    perMonth: rule.rate * Math.ceil(lateDays / 30),
  };
  return { amount: round2(amounts[rule.type as Exclude<LateFeeType, 'none'>] ?? 0), lateDays, balance: round2(Math.max(balanceOnAsOf, 0)) };
}

/** One line for the screen. English for the PDF (labels there are helvetica). */
export function describeLateFeeRule(rule: LateFeeRule, hi: boolean): string {
  const grace = Number(rule.graceDays) > 0 ? rule.graceDays : 0;
  const rate = Number(rule.rate);
  const text: Record<Exclude<LateFeeType, 'none'>, [string, string]> = {
    percent: [`विलंब ब्याज ${rate}% सालाना`, `Late interest ${rate}% a year`],
    flat: [`पेनल्टी ₹${rate} एकमुश्त`, `Penalty Rs. ${rate} once`],
    perDay: [`पेनल्टी ₹${rate} प्रति दिन`, `Penalty Rs. ${rate} a day`],
    perMonth: [`पेनल्टी ₹${rate} प्रति माह`, `Penalty Rs. ${rate} a month`],
  };
  const pair = text[rule.type as Exclude<LateFeeType, 'none'>];
  if (!pair) return hi ? 'कोई शुल्क नहीं' : 'No charge';
  const base = hi ? pair[0] : pair[1];
  if (!grace) return base;
  return hi ? `${base}, ${grace} दिन की छूट के बाद` : `${base}, after ${grace} grace days`;
}
