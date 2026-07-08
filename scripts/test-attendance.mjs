// Attendance pro-ration (ECR-14) — mirrors src/lib/attendance.ts.
// Run: node scripts/test-attendance.mjs

const r2 = (n) => Math.round(n * 100) / 100;
function daysInMonth(yyyymm) {
  const m = /^(\d{4})-(\d{2})$/.exec(yyyymm || '');
  if (!m) return 30;
  return new Date(Number(m[1]), Number(m[2]), 0).getDate();
}
const clampPaidDays = (paid, total) => Math.max(0, Math.min(total, Math.round(paid || 0)));
function prorate(amount, paidDays, monthDays) {
  if (!(monthDays > 0)) return r2(amount || 0);
  const paid = clampPaidDays(paidDays, monthDays);
  if (paid >= monthDays) return r2(amount || 0);
  return r2((amount || 0) * paid / monthDays);
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. Days in month, leap-year aware.
ok(daysInMonth('2024-02') === 29, 'Feb 2024 = 29 (leap)');
ok(daysInMonth('2025-02') === 28, 'Feb 2025 = 28');
ok(daysInMonth('2024-04') === 30 && daysInMonth('2024-01') === 31, 'Apr 30, Jan 31');
ok(daysInMonth('bad') === 30, 'unparseable → 30 fallback');

// 2. Full attendance → amount unchanged.
ok(prorate(30000, 30, 30) === 30000, 'full month unchanged');
ok(prorate(30000, 31, 30) === 30000, 'paid > month clamps to full → unchanged');

// 3. Partial attendance pro-rates.
ok(prorate(30000, 15, 30) === 15000, '15/30 days → half');
ok(prorate(31000, 20, 31) === 20000, '20/31 days of 31000 → 20000');
ok(prorate(30000, 0, 30) === 0, 'zero days → 0');

// 4. Clamp negatives.
ok(prorate(30000, -5, 30) === 0, 'negative days clamped to 0');
ok(clampPaidDays(45, 30) === 30 && clampPaidDays(-3, 30) === 0, 'clamp bounds');

// 5. Rounding to 2dp.
ok(prorate(10000, 10, 30) === r2(10000 * 10 / 30), '10/30 rounds to 2dp');

console.log(`\nAttendance (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
