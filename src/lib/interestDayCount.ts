/**
 * Interest day count — how many days a period has, and what fraction of a year that is.
 *
 * NABARD's PACS computerisation RFP (§16.1.2) asks that interest follow "pre-set parameters like
 * rate of interest, period (including days) of interest applicability". It does not prescribe the
 * year basis — that is the society's / its bank's policy — so it is a society setting:
 *   '365'    — every year is 365 days (the app's behaviour so far; the default).
 *   'actual' — each day is 1/365 or 1/366 of a year, by the calendar year it falls in.
 *   '360'    — every year is 360 days.
 * PURE. Dates are YYYY-MM-DD, handled in UTC arithmetic so no timezone can shift a day.
 */
export type DayCountBasis = '365' | 'actual' | '360';
export const DEFAULT_DAY_COUNT: DayCountBasis = '365';
export const DAY_COUNT_OPTIONS: { value: DayCountBasis; label: string; labelHi: string }[] = [
  { value: '365', label: '365 days a year (default)', labelHi: 'साल = 365 दिन (डिफ़ॉल्ट)' },
  { value: 'actual', label: 'Actual — 366 in a leap year', labelHi: 'वास्तविक — लीप वर्ष में 366' },
  { value: '360', label: '360 days a year', labelHi: 'साल = 360 दिन' },
];

const DAY = 86_400_000;
const utc = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/**
 * Days in a period, BOTH ends included: 01-09 → 30-09 is 30 days. Consecutive periods
 * (…30-09 | 01-10…) then count every calendar day exactly once.
 */
export function periodDays(from: string, to: string): number {
  if (!from || !to) return 0;
  const n = Math.round((utc(to) - utc(from)) / DAY) + 1;
  return Math.max(0, n);
}

/** Year fraction of the `days` days ending on (and including) `periodTo`. */
export function yearFraction(periodTo: string, days: number, basis: DayCountBasis = DEFAULT_DAY_COUNT): number {
  const n = Math.max(0, Math.floor(days));
  if (basis === '360') return n / 360;
  if (basis !== 'actual' || !periodTo) return n / 365;
  // Actual: split the period at 1 January, each part over its own year length.
  let frac = 0;
  let end = utc(periodTo);
  let left = n;
  while (left > 0) {
    const y = new Date(end).getUTCFullYear();
    const yearStart = Date.UTC(y, 0, 1);
    const inThisYear = Math.min(left, Math.round((end - yearStart) / DAY) + 1);
    frac += inThisYear / (isLeap(y) ? 366 : 365);
    left -= inThisYear;
    end = yearStart - DAY;
  }
  return frac;
}

/** Simple interest for the period, rounded to paise. */
export function periodInterest(principal: number, ratePa: number, periodTo: string, days: number, basis: DayCountBasis = DEFAULT_DAY_COUNT): number {
  return Math.round((Number(principal) || 0) * ((Number(ratePa) || 0) / 100) * yearFraction(periodTo, days, basis) * 100) / 100;
}

export const asDayCount = (v: unknown): DayCountBasis => (v === 'actual' || v === '360' || v === '365' ? v : DEFAULT_DAY_COUNT);
