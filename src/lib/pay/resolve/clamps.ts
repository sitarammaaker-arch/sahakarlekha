/**
 * Statutory floor / ceiling clamps (Phase-7 §3/§8). PURE. Applied AFTER a value is selected, so
 * "most-specific-wins" and "the statutory minimum is inviolable" coexist: specificity chooses the
 * value; a floor clamps it UP and a ceiling clamps it DOWN. An org may set any value within
 * [floor, ceiling]; outside that band the clamp wins and the event is recorded (for the trace).
 *
 * Values are numeric (money in integer Minor / paise, or a plain number for a rate/day count).
 * Reuse: the Minor type from money.ts (type-only, erased under type-stripping).
 */

import type { Minor } from '@/lib/money';

export type ClampKind = 'none' | 'floor' | 'ceiling';

export interface ClampBounds {
  /** Inclusive lower bound — value is raised to at least this. */
  floor?: number | null;
  /** Inclusive upper bound — value is lowered to at most this. */
  ceiling?: number | null;
}

export interface ClampResult {
  value: number;
  /** Which bound (if any) was applied — recorded in the calc/resolution trace. */
  clamped: ClampKind;
  floor?: number | null;
  ceiling?: number | null;
}

/**
 * PURE — clamp a value to [floor, ceiling]. Floor takes precedence conceptually (a statutory
 * minimum can never be breached), but a well-formed catalog has floor <= ceiling; floor > ceiling
 * is a CATALOG DEFECT and throws. Missing bounds are ignored.
 */
export function applyClamp(value: number, bounds: ClampBounds): ClampResult {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError('clamp: value must be a finite number');
  }
  const floor = bounds.floor ?? null;
  const ceiling = bounds.ceiling ?? null;
  if (floor != null && ceiling != null && floor > ceiling) {
    throw new RangeError(`PAY-CMP-CLAMP: floor (${floor}) > ceiling (${ceiling}) — catalog defect`);
  }
  if (ceiling != null && value > ceiling) {
    return { value: ceiling, clamped: 'ceiling', floor, ceiling };
  }
  if (floor != null && value < floor) {
    return { value: floor, clamped: 'floor', floor, ceiling };
  }
  return { value, clamped: 'none', floor, ceiling };
}

/** PURE — money convenience: clamp a Minor amount (paise). Identical logic, typed for clarity. */
export function clampMinor(valueMinor: Minor, bounds: { floorMinor?: Minor | null; ceilingMinor?: Minor | null }): ClampResult {
  return applyClamp(valueMinor, { floor: bounds.floorMinor ?? null, ceiling: bounds.ceilingMinor ?? null });
}
