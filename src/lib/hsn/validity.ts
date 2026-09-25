/**
 * hsn/validity.ts — HSN digit-length requirement by turnover (Slice 4).
 *
 * GST rule (per CBIC, PIB 1 Apr 2021): a registered person with aggregate
 * turnover (preceding FY)
 *   > ₹5 crore  → must quote a 6-digit HSN on invoices,
 *   ≤ ₹5 crore  → 4-digit HSN (on B2B invoices).
 *
 * ⚠️ The threshold below is a statutory value — verify against the current CBIC
 * notification before relying on it, and change it HERE (one place) if it moves.
 * Pure functions only: validity is DERIVED from (code + society AATO) at use time,
 * never stored on the item (RULE 2 — a stored status would go stale when AATO
 * crosses the threshold in a new FY).
 */

// ₹5 crore, in rupees. Config-in-one-place, not scattered literals.
export const HSN_6DIGIT_TURNOVER_THRESHOLD = 5_00_00_000;

/** Digits required for a valid HSN given the society's preceding-FY AATO. */
export function requiredHsnDigits(aato: number | undefined | null): 4 | 6 {
  return (aato ?? 0) > HSN_6DIGIT_TURNOVER_THRESHOLD ? 6 : 4;
}

/** Count of numeric digits in an HSN/SAC code (ignores spaces/other chars). */
export function hsnDigitCount(code: string | undefined | null): number {
  return (code ?? '').replace(/\D/g, '').length;
}

export interface HsnDigitCheck {
  required: 4 | 6;
  actual: number;
  /** true when the code has AT LEAST the required digits (or there is no code to judge). */
  ok: boolean;
  /** true only when a code is present but has fewer digits than required. */
  insufficient: boolean;
}

/**
 * Judge one HSN/SAC code against the society's AATO requirement.
 * An empty code is `ok` here (its absence is handled by the presence guard,
 * Slice 3) — this function only judges DIGIT SUFFICIENCY of a code that exists.
 */
export function checkHsnDigits(code: string | undefined | null, aato: number | undefined | null): HsnDigitCheck {
  const required = requiredHsnDigits(aato);
  const actual = hsnDigitCount(code);
  const hasCode = actual > 0;
  const ok = !hasCode || actual >= required;
  return { required, actual, ok, insufficient: hasCode && actual < required };
}
