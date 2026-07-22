/**
 * Payslip aggregation (Phase-8). PURE. Turns the plan's computed component values into a structured
 * payslip: each component is classified as an earning, a deduction, or intermediate `info`, statutory
 * clamps are applied at value-use, and the totals are derived — net = gross earnings − gross
 * deductions. The component catalog stays the source of truth; net is NEVER re-stated in a formula
 * (decision B), so a component can't be double-counted.
 *
 * Two safety rules from the spine:
 *   · Refuse-over-guess — EVERY computed component must be classified. A component present in the
 *     values but absent from the classification is a config gap (PAY-CAL-601), not a silent drop:
 *     an unclassified real earning would understate pay. `info` explicitly excludes an intermediate
 *     from the totals — silence is never the default.
 *   · Money-safety — an earning/deduction line must be a MoneyValue in the payslip currency
 *     (PAY-CAL-602 / PAY-CAL-603); a bare number can't become a rupee amount by accident.
 *
 * Clamps (resolve/clamps.ts) meet each figure at its floor/ceiling here, at value-use, exactly as
 * the resolver's contract intends — and the applied bound is recorded on the line for the trace.
 */

import { applyClamp, type ClampBounds, type ClampKind } from '../resolve/clamps.ts';
import { makeMoney, type MoneyValue, type Value } from '../formula/evaluator.ts';

export type ComponentSide = 'earning' | 'deduction' | 'info';

export interface PayslipLine {
  code: string;
  side: ComponentSide;
  amount: MoneyValue;
  /** Which statutory bound (if any) clamped the raw figure — for the calc trace. */
  clamped: ClampKind;
}

export interface Payslip {
  currency: string;
  earnings: PayslipLine[];
  deductions: PayslipLine[];
  grossEarnings: MoneyValue;
  grossDeductions: MoneyValue;
  /** gross earnings − gross deductions (may be negative if recovery exceeds pay — surfaced, not hidden). */
  netPay: MoneyValue;
}

export interface AggregateSpec {
  currency: string;
  /** Side for EVERY computed component. A missing entry refuses (PAY-CAL-601). */
  classification: Record<string, ComponentSide>;
  /** Optional per-component statutory bounds (paise), applied at value-use. */
  clamps?: Record<string, ClampBounds>;
}

const isMoney = (v: Value): v is MoneyValue =>
  !!v && typeof v === 'object' && (v as { kind?: string }).kind === 'money';

/**
 * PURE — aggregate computed component values into a payslip. Iterates the values in plan order
 * (their insertion order), so lines are deterministic. Throws on an unclassified component
 * (PAY-CAL-601), a non-money or wrong-currency earning/deduction (PAY-CAL-602 / 603).
 */
export function aggregatePayslip(values: Record<string, Value>, spec: AggregateSpec): Payslip {
  const earnings: PayslipLine[] = [];
  const deductions: PayslipLine[] = [];
  let grossEarningsMinor = 0;
  let grossDeductionsMinor = 0;

  for (const code of Object.keys(values)) {
    const side = spec.classification[code];
    if (side === undefined) {
      throw new RangeError(`PAY-CAL-601: component '${code}' is computed but unclassified (earning/deduction/info required)`);
    }
    if (side === 'info') continue; // intermediate — deliberately excluded from the payslip

    const raw = values[code];
    if (!isMoney(raw)) {
      throw new RangeError(`PAY-CAL-602: ${side} component '${code}' must be a money value`);
    }
    if (raw.currency !== spec.currency) {
      throw new RangeError(`PAY-CAL-603: component '${code}' is ${raw.currency}, payslip currency is ${spec.currency}`);
    }

    const bounds = spec.clamps?.[code];
    const clamp = bounds ? applyClamp(raw.minor, bounds) : { value: raw.minor, clamped: 'none' as ClampKind };
    const line: PayslipLine = { code, side, amount: makeMoney(clamp.value, spec.currency), clamped: clamp.clamped };

    if (side === 'earning') { earnings.push(line); grossEarningsMinor += clamp.value; }
    else { deductions.push(line); grossDeductionsMinor += clamp.value; }
  }

  return {
    currency: spec.currency,
    earnings,
    deductions,
    grossEarnings: makeMoney(grossEarningsMinor, spec.currency),
    grossDeductions: makeMoney(grossDeductionsMinor, spec.currency),
    netPay: makeMoney(grossEarningsMinor - grossDeductionsMinor, spec.currency),
  };
}
