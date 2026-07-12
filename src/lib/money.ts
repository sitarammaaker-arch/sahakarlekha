/**
 * Money — exact arithmetic in integer minor units (T-02 / ADR-0006, Canonical CL-3).
 *
 * PURE. The one place money is added, subtracted, multiplied and rounded — so a rupee is
 * never an IEEE-754 float that drifts in the last paisa across thousands of legs (the
 * phantom-balance class of bug, RULE 2 / CA-02).
 *
 * THE DISCIPLINE
 *   • A `Minor` is an INTEGER number of paise (₹1.00 = 100). Integer sums are exact.
 *   • Convert to minor units as early as possible (`toMinor`), do ALL arithmetic in minor
 *     units, and round ONLY at defined points through `roundMinor` — the single rounding
 *     function.
 *   • Every rounding step RECORDS the policy it used: `applyPercent` / `mulMinor` return
 *     `{ minor, mode }`, so a posted amount can carry the rounding that produced it
 *     (ADR-0006: "every rounding step applies an explicit, recorded rounding policy").
 *
 * WHAT THIS IS NOT. It does not decide Dr/Cr — an amount is an unsigned magnitude here; the
 * ledger carries the Dr/Cr indicator separately (Canonical CL-3). It does not read the DB;
 * storage stays PG `numeric` (exact at rest). This fixes the COMPUTE layer.
 */

/** An integer number of paise. ₹1.00 = 100. The unit of record for all money math. */
export type Minor = number;

/** Rounding policies. `half-up` (round half AWAY from zero) is the commercial/statutory
 *  default; `half-even` is banker's rounding; `down`/`up` truncate toward/away from zero. */
export type RoundingMode = 'half-up' | 'half-even' | 'down' | 'up';

export const DEFAULT_ROUNDING: RoundingMode = 'half-up';
export const DEFAULT_CURRENCY = 'INR';

/** A rounded amount together with the policy that produced it — so callers can record it. */
export interface RoundedResult {
  minor: Minor;
  mode: RoundingMode;
}

function assertFinite(value: number, where: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`money.${where}: value is not finite (${value})`);
}

function assertMinor(value: number, where: string): void {
  if (!Number.isInteger(value)) throw new RangeError(`money.${where}: minor units must be an integer paise value, got ${value}`);
}

/** PURE — is this a valid minor-unit amount (a finite integer)? */
export function isValidMinor(value: unknown): value is Minor {
  return typeof value === 'number' && Number.isInteger(value);
}

/**
 * PURE — round a fractional paise VALUE to an integer paise, by policy. THE single rounding
 * function; everything that can produce a fraction (conversion, a percentage, a rate) goes
 * through here, so the codebase rounds in exactly one, testable way.
 */
export function roundMinor(value: number, mode: RoundingMode = DEFAULT_ROUNDING): Minor {
  assertFinite(value, 'roundMinor');
  switch (mode) {
    case 'down':
      return Math.trunc(value);
    case 'up':
      return value >= 0 ? Math.ceil(value) : Math.floor(value);
    case 'half-even': {
      const floor = Math.floor(value);
      const diff = value - floor;
      if (diff < 0.5) return floor;
      if (diff > 0.5) return floor + 1;
      return floor % 2 === 0 ? floor : floor + 1; // exactly .5 → to even
    }
    case 'half-up':
    default:
      // Round half AWAY from zero (Math.round alone rounds -0.5 toward zero).
      return value >= 0 ? Math.round(value) : -Math.round(-value);
  }
}

/** PURE — rupees (as entered) → exact integer paise. Rounds via policy, absorbing the float
 *  imprecision of `rupees * 100` (e.g. 0.29 → 29, not 28.999…). */
export function toMinor(rupees: number, mode: RoundingMode = DEFAULT_ROUNDING): Minor {
  assertFinite(rupees, 'toMinor');
  return roundMinor(rupees * 100, mode);
}

/** PURE — integer paise → rupees, for display / interop. Exact. */
export function toRupees(minor: Minor): number {
  assertMinor(minor, 'toRupees');
  return minor / 100;
}

/** PURE — exact sum of minor amounts (integer arithmetic; no rounding). */
export function addMinor(...values: Minor[]): Minor {
  let sum = 0;
  for (const v of values) { assertMinor(v, 'addMinor'); sum += v; }
  return sum;
}

/** PURE — exact sum over an iterable of minor amounts. */
export function sumMinor(values: Iterable<Minor>): Minor {
  let sum = 0;
  for (const v of values) { assertMinor(v, 'sumMinor'); sum += v; }
  return sum;
}

/** PURE — exact a − b in minor units. */
export function subMinor(a: Minor, b: Minor): Minor {
  assertMinor(a, 'subMinor'); assertMinor(b, 'subMinor');
  return a - b;
}

/** PURE — exact negation (a magnitude does not carry sign; this is for internal math). */
export function negateMinor(a: Minor): Minor {
  assertMinor(a, 'negateMinor');
  return -a;
}

/** PURE — base × factor, rounded, WITH the policy recorded. e.g. a quantity × unit-rate. */
export function mulMinor(baseMinor: Minor, factor: number, mode: RoundingMode = DEFAULT_ROUNDING): RoundedResult {
  assertMinor(baseMinor, 'mulMinor');
  assertFinite(factor, 'mulMinor');
  return { minor: roundMinor(baseMinor * factor, mode), mode };
}

/** PURE — a percentage of a base amount, rounded, WITH the policy recorded. e.g. GST 18%. */
export function applyPercent(baseMinor: Minor, pct: number, mode: RoundingMode = DEFAULT_ROUNDING): RoundedResult {
  assertMinor(baseMinor, 'applyPercent');
  assertFinite(pct, 'applyPercent');
  return { minor: roundMinor((baseMinor * pct) / 100, mode), mode };
}

/**
 * PURE — split a total into integer-paise parts by weight, LARGEST-REMAINDER so the parts
 * sum to EXACTLY `totalMinor` (never ±1 paisa off). Each slot gets the floor of its ideal
 * share; the leftover paise go to the largest fractional remainders first. This is how a net
 * amount is apportioned across per-account / per-item voucher lines so the voucher balances
 * BY CONSTRUCTION (the RULE 4 split) instead of leaning on a rounding tolerance.
 *
 * Non-positive / non-finite weights count as 0. If every weight is 0, the whole total lands
 * on the first slot. Works for a negative total too (e.g. a net return). Result length
 * always === weights.length.
 */
export function allocateMinor(totalMinor: Minor, weights: number[]): Minor[] {
  assertMinor(totalMinor, 'allocateMinor');
  const n = weights.length;
  if (n === 0) return [];
  const w = weights.map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
  const totalWeight = w.reduce((s, x) => s + x, 0);
  if (totalWeight === 0) {
    const out = new Array<Minor>(n).fill(0);
    out[0] = totalMinor;
    return out;
  }
  const ideal = w.map((x) => (totalMinor * x) / totalWeight);
  const out = ideal.map((v) => Math.floor(v));
  let residual = totalMinor - out.reduce((s, x) => s + x, 0); // integer paise left to hand out, in [0, n)
  const order = ideal
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < order.length && residual > 0; k++) { out[order[k].i] += 1; residual -= 1; }
  return out;
}

/** Indian digit grouping for an integer string: last 3, then groups of 2 (12,34,567). */
function groupIndian(intStr: string): string {
  if (intStr.length <= 3) return intStr;
  const last3 = intStr.slice(-3);
  const rest = intStr.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+$)/g, ',') + ',' + last3;
}

/** PURE — format minor units for display (Indian grouping, 2 decimals). Optional ₹ symbol.
 *  Deterministic — does not depend on the runtime locale. */
export function formatMinor(minor: Minor, opts: { symbol?: boolean } = {}): string {
  assertMinor(minor, 'formatMinor');
  const negative = minor < 0;
  const [intPart, decPart] = (Math.abs(minor) / 100).toFixed(2).split('.');
  const body = (opts.symbol ? '₹' : '') + groupIndian(intPart) + '.' + decPart;
  return negative ? '-' + body : body;
}
