/**
 * Attendance pro-ration for salary (ECR-14 — paid-days / LOP).
 *
 * Earned pay = master pay × paid-days / days-in-month. Pro-rating basic + allowances before
 * the statutory computation means PF/ESI are computed on the actually-earned wage. Pure →
 * unit-tested by scripts/test-attendance.mjs.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Calendar days in a "YYYY-MM" month (leap-year aware). Falls back to 30 if unparseable. */
export function daysInMonth(yyyymm: string): number {
  const m = /^(\d{4})-(\d{2})$/.exec(yyyymm || '');
  if (!m) return 30;
  return new Date(Number(m[1]), Number(m[2]), 0).getDate();
}

/** Clamp paid days into [0, monthDays]. */
export function clampPaidDays(paidDays: number, monthDays: number): number {
  return Math.max(0, Math.min(monthDays, Math.round(paidDays || 0)));
}

/** Pro-rate an amount by paid days. Full month (paid ≥ total) returns the amount unchanged. */
export function prorate(amount: number, paidDays: number, monthDays: number): number {
  if (!(monthDays > 0)) return r2(amount || 0);
  const paid = clampPaidDays(paidDays, monthDays);
  if (paid >= monthDays) return r2(amount || 0);
  return r2((amount || 0) * paid / monthDays);
}
