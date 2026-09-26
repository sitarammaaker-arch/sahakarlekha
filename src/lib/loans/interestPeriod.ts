/**
 * Default period for the Loan Interest page. PURE.
 *
 * Dates are built from LOCAL year/month/day — never via toISOString(), which converts to UTC and, in
 * India (UTC+5:30), shifted every date one day back (September became 31-08 → 29-09). Annual follows
 * the Indian FY (April–March), so January–March belong to the FY that started the previous April.
 */
export type InterestPeriodMode = 'monthly' | 'quarterly' | 'annual';

const ymd = (y: number, m0: number, d: number): string => {
  const dt = new Date(y, m0, d); // normalises overflow (e.g. day 0 = last day of the previous month)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

export function interestPeriodDefaults(mode: InterestPeriodMode, now: Date = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  if (mode === 'monthly') return { from: ymd(y, m, 1), to: ymd(y, m + 1, 0) };
  if (mode === 'quarterly') {
    const qStart = Math.floor(m / 3) * 3;
    return { from: ymd(y, qStart, 1), to: ymd(y, qStart + 3, 0) };
  }
  const fyStart = m >= 3 ? y : y - 1; // April (3) onwards → this year's FY
  return { from: `${fyStart}-04-01`, to: `${fyStart + 1}-03-31` };
}
