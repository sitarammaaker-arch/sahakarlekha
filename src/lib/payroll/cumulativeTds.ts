/**
 * Cumulative salary-TDS recomputation (s.192 / Act 2025 s.392). PURE.
 *
 * THE DEFECT THIS FIXES. SalaryManagement called `suggestMonthlyTds(gross, regime)` —
 * two arguments — so every month deducted annual-tax ÷ 12, whether it was April or
 * March, and regardless of what had already been deducted. `monthsRemaining` existed on
 * the function and was never passed. So an over-deduction never self-corrected: the
 * employee waited for an ITR refund for money the society was holding.
 *
 * That is not how salary TDS works. It is CUMULATIVE: each run re-estimates the whole
 * year, subtracts what has actually been deducted so far, and spreads only the balance
 * over the months that remain. An error in April is absorbed by August.
 *
 *     monthly TDS = (annual tax − TDS already deducted this FY) ÷ months remaining
 *
 * CONFIRMED by the society's CA (2026-07-16, docs/CA-VERIFICATION-2026-07.md follow-up),
 * including the one judgement call: on over-deduction the remaining months go to zero
 * AND a human is told — never a silent zero. Payroll cannot refund; the employee has to
 * know to claim it, or they quietly lose it. A silent zero would be the same class of
 * defect as the one this file exists to fix: correct-looking, and wrong for the person.
 */
import { annualIncomeTax, type TaxRegime } from '../tdsProjection';

export interface CumulativeTdsInput {
  /** Projected gross for the WHOLE financial year (not monthly). */
  annualGross: number;
  regime: TaxRegime;
  /** Chapter VI-A total; old regime only. */
  otherDeductions?: number;
  /** TDS actually deducted so far THIS financial year, across all prior runs. */
  ytdDeducted: number;
  /** Months left to deduct in, INCLUDING the one being processed. Never < 1. */
  monthsRemaining: number;
  /**
   * The date whose law applies — REQUIRED, deliberately.
   *
   * It was optional for about an hour, and in that hour the very first caller forgot it
   * and silently got today's law for a payslip from another year — the exact defect this
   * module was written to clean up (tdsProjection applying FY 2024-25 slabs in FY 2026-27),
   * reintroduced one layer up by the same hand, the same day.
   *
   * A defaulted date is a defect generator in a system of statutory record: the caller
   * always HAS the month — `monthsRemaining` is already derived from it — so letting the
   * law come from somewhere else guarantees the two eventually disagree. Required makes
   * that mistake a compile error instead of a wrong number on someone's payslip. Pass
   * the month being processed, never `new Date()`.
   */
  asOf: string;
}

export interface CumulativeTdsResult {
  /** What to deduct this month. Never negative — payroll cannot refund. */
  tds: number;
  /** Full-year liability under the law in force at `asOf`. */
  annualTax: number;
  ytdDeducted: number;
  /** Still to be deducted across the remaining months. 0 when already over-deducted. */
  balance: number;
  /**
   * > 0 ⇒ MORE has been deducted than the year's liability. The UI MUST surface this:
   * payroll cannot give it back, so the employee only recovers it by filing their ITR —
   * unless the excess was never deposited by challan, in which case the society can
   * simply return it (see `docs/` and the CA note). Either way, a human decides.
   */
  excess: number;
}

/**
 * PURE — what should this month's salary TDS be, given the year so far?
 *
 * Guards, in order of how badly each would hurt someone:
 *   • never negative — a negative "deduction" would silently pay an employee from the
 *     TDS head and corrupt both the salary and the statutory ledger;
 *   • never divide by zero or a negative month count;
 *   • an over-deduction is REPORTED, not absorbed.
 */
export function cumulativeMonthlyTds(input: CumulativeTdsInput): CumulativeTdsResult {
  const annualTax = annualIncomeTax(
    Math.max(0, input.annualGross || 0),
    input.regime,
    input.otherDeductions || 0,
    input.asOf,
  );
  const ytdDeducted = Math.max(0, input.ytdDeducted || 0);
  const months = Math.max(1, Math.floor(input.monthsRemaining || 1));

  const remaining = annualTax - ytdDeducted;
  if (remaining <= 0) {
    return { tds: 0, annualTax, ytdDeducted, balance: 0, excess: ytdDeducted - annualTax };
  }
  return { tds: Math.round(remaining / months), annualTax, ytdDeducted, balance: remaining, excess: 0 };
}

/**
 * PURE — months left in the financial year, counting the month being processed.
 *
 * The Indian FY runs April→March, so `month` is 1-based from April: April = 12 left,
 * March = 1. A month outside the FY (impossible via the picker, but not via a URL or a
 * bad import) clamps to 1..12 rather than producing a nonsense divisor.
 */
export function monthsLeftInFy(processingMonth: string): number {
  const m = Number((processingMonth || '').slice(5, 7));
  if (!Number.isFinite(m) || m < 1 || m > 12) return 1;
  // April(4) → 12 … December(12) → 4 … January(1) → 3 … March(3) → 1
  return m >= 4 ? 12 - (m - 4) : 4 - m;
}

/**
 * PURE — the financial year a YYYY-MM month belongs to, as its April..March bounds.
 * April 2026 and January 2027 are both FY 2026-27; that is the window YTD must sum over,
 * and getting it wrong would silently mix two years' deductions.
 */
export function fyBounds(processingMonth: string): { from: string; to: string; label: string } {
  const y = Number((processingMonth || '').slice(0, 4));
  const m = Number((processingMonth || '').slice(5, 7));
  const startYear = Number.isFinite(y) && Number.isFinite(m) && m >= 4 ? y : y - 1;
  const s = String(startYear);
  return {
    from: `${s}-04`,
    to: `${startYear + 1}-03`,
    label: `FY ${s}-${String(startYear + 1).slice(2)}`,
  };
}

/** PURE — is `month` (YYYY-MM) inside this FY window? Both bounds inclusive. */
export function isInFy(month: string, bounds: { from: string; to: string }): boolean {
  return !!month && month >= bounds.from && month <= bounds.to;
}
