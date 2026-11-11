/**
 * Form 24Q — quarterly salary TDS (u/s 192) return (ECR-14).
 *
 * Summarises, per quarter, each employee's salary paid and TDS deducted from the salary
 * records — the basis for the 24Q return. Pure → unit-tested by scripts/test-form24Q.mjs.
 */
import type { SalaryRecord, Employee } from '@/types';

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The three "YYYY-MM" months of an FY quarter. FY "2024-25": Q1=Apr–Jun … Q4=Jan–Mar(2025). */
export function quarterMonths(fy: string, q: Quarter): string[] {
  const startYear = Number((fy || '').split('-')[0]) || 0;
  const nextYear = startYear + 1;
  const spec: Record<Quarter, [number, number][]> = {
    Q1: [[startYear, 4], [startYear, 5], [startYear, 6]],
    Q2: [[startYear, 7], [startYear, 8], [startYear, 9]],
    Q3: [[startYear, 10], [startYear, 11], [startYear, 12]],
    Q4: [[nextYear, 1], [nextYear, 2], [nextYear, 3]],
  };
  return spec[q].map(([y, m]) => `${y}-${String(m).padStart(2, '0')}`);
}

/**
 * WHEN salary TDS counts (2026-11-11). Income-tax Act 2025, s.392(1): the deduction on salary "shall be made at
 * the time of such payment" — source: https://incometaxindia.gov.in/w/section-392-5 (Act 2025, Chapter XIX-B).
 * So a slip's TDS is deducted when the salary is PAID, and belongs to the quarter / tax year of the payment date —
 * not of the salary month (a September salary paid on 6 October is October's deduction). An unpaid slip has no
 * deduction yet: its TDS is only accrued in the books (Cr 2202 at month-end) until it is paid.
 * A paid slip with no recorded paid date (older data) falls back to the salary month.
 * Returns null for an unpaid slip. PURE — shared by Form 24Q / 138 and the TDS Register.
 */
export function salaryTdsWhen(rec: Pick<SalaryRecord, 'isPaid' | 'paidDate' | 'month'>): { date: string; month: string; quarter: Quarter; fy: string } | null {
  if (!rec.isPaid) return null;
  const date = /^\d{4}-\d{2}-\d{2}/.test(rec.paidDate || '') ? (rec.paidDate as string).slice(0, 10) : `${rec.month}-01`;
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7));
  if (!y || !m) return null;
  const fyStart = m >= 4 ? y : y - 1;
  const quarter: Quarter = m >= 4 && m <= 6 ? 'Q1' : m >= 7 && m <= 9 ? 'Q2' : m >= 10 ? 'Q3' : 'Q4';
  return { date, month: date.slice(0, 7), quarter, fy: `${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}` };
}

export interface Form24QRow {
  empNo: string;
  name: string;
  pan: string;
  grossSalary: number;
  tds: number;
}
export interface Form24Q {
  months: string[];
  rows: Form24QRow[];
  totals: { grossSalary: number; tds: number; deductees: number };
}

/** Build the 24Q summary for an FY quarter: one row per employee PAID in that quarter (salaryTdsWhen). */
export function build24Q(salaryRecords: SalaryRecord[], employees: Employee[], fy: string, q: Quarter): Form24Q {
  const months = quarterMonths(fy, q);
  const inQ = (salaryRecords || []).filter(rec => { const w = salaryTdsWhen(rec); return !!w && w.fy === fy && w.quarter === q; });
  const byEmp = new Map<string, { grossSalary: number; tds: number }>();
  for (const rec of inQ) {
    const cur = byEmp.get(rec.employeeId) || { grossSalary: 0, tds: 0 };
    cur.grossSalary += (rec.basicSalary || 0) + (rec.allowances || 0);
    cur.tds += rec.tds || 0;
    byEmp.set(rec.employeeId, cur);
  }
  const rows: Form24QRow[] = [...byEmp.entries()].map(([empId, v]) => {
    const emp = (employees || []).find(e => e.id === empId);
    return { empNo: emp?.empNo || '', name: emp?.name || '', pan: emp?.pan || '', grossSalary: r2(v.grossSalary), tds: r2(v.tds) };
  }).sort((a, b) => a.empNo.localeCompare(b.empNo));
  return {
    months,
    rows,
    totals: {
      grossSalary: r2(rows.reduce((s, r) => s + r.grossSalary, 0)),
      tds: r2(rows.reduce((s, r) => s + r.tds, 0)),
      deductees: rows.length,
    },
  };
}
