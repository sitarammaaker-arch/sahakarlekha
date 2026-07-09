/**
 * RD installment schedule (Deposits module — Recurring Deposit).
 *
 * An RD is a fixed monthly installment paid from openDate until maturityDate. This derives
 * the expected schedule and marks each installment paid / due / missed from the total paid
 * so far and the as-of date. Pure & deterministic → unit-tested by scripts/test-rd-schedule.mjs.
 */

/** Add n months to a YYYY-MM-DD date, clamping the day to the target month's length. */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(ny, nm, 0).getDate();   // day 0 of next month = last day of nm
  const nd = Math.min(d, lastDay);
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

/** Whole months between two YYYY-MM-DD dates (b − a), by month boundary. */
export function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by * 12 + bm) - (ay * 12 + am);
}

export type RdInstallmentStatus = 'paid' | 'due' | 'missed';
export interface RdInstallment {
  installmentNo: number;
  dueDate: string;
  amount: number;
  status: RdInstallmentStatus;
}

export interface RdScheduleInput {
  openDate: string;
  installmentAmount: number;
  maturityDate?: string;
  totalPaid: number;   // total deposited into the account so far
  asOf: string;        // date to evaluate due/missed against
}

/**
 * Build the RD schedule. Installment i is due at openDate + (i−1) months. The first
 * floor(totalPaid / installmentAmount) installments are paid; a later installment whose
 * due date has passed is 'missed', otherwise 'due'.
 */
export function buildRdSchedule({ openDate, installmentAmount, maturityDate, totalPaid, asOf }: RdScheduleInput): RdInstallment[] {
  if (!maturityDate || !(installmentAmount > 0)) return [];
  const n = Math.max(0, monthsBetween(openDate, maturityDate));
  const paidCount = Math.floor((totalPaid || 0) / installmentAmount + 1e-9);
  const rows: RdInstallment[] = [];
  for (let i = 1; i <= n; i++) {
    const dueDate = addMonths(openDate, i - 1);
    const status: RdInstallmentStatus = i <= paidCount ? 'paid' : (dueDate < asOf ? 'missed' : 'due');
    rows.push({ installmentNo: i, dueDate, amount: installmentAmount, status });
  }
  return rows;
}

/** Count of missed installments in a schedule. */
export function missedCount(schedule: RdInstallment[]): number {
  return schedule.filter(s => s.status === 'missed').length;
}
