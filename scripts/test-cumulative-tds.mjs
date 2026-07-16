// Cumulative salary-TDS recomputation (s.192 / Act 2025 s.392).
//
// The defect: SalaryManagement deducted annual-tax ÷ 12 EVERY month, so an over- or
// under-deduction never self-corrected. `monthsRemaining` existed on the function and
// was never passed. Salary TDS is cumulative — each run re-estimates the year, subtracts
// what was actually deducted, and spreads only the balance over the months left.
//
// The load-bearing assertions here are the boundaries, because that is where someone's
// money goes wrong: never negative, never a silent zero on over-deduction, and April vs
// March counted correctly.
//
// Run: node scripts/test-cumulative-tds.mjs   (npm run test:cumulative-tds)

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadViteModule } from './lib/vite-bundle.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const M = await loadViteModule(ROOT, resolve(ROOT, 'src', 'lib', 'payroll', 'cumulativeTds.ts'), 'eval');
const { cumulativeMonthlyTds, monthsLeftInFy, fyBounds, isInFy } = M;

const FY26 = '2026-08-01'; // inside FY 2026-27 — the CA-verified law
let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  — ' + detail : '')); }
};

console.log('\n  Cumulative salary TDS — the year, not the month\n');

/* 1 · FY MATH — getting this wrong silently mixes two years' deductions. */
{
  ok('months: April → 12 left (the whole year)', monthsLeftInFy('2026-04') === 12);
  ok('months: August → 8 left', monthsLeftInFy('2026-08') === 8);
  ok('months: December → 4 left', monthsLeftInFy('2026-12') === 4);
  ok('months: January → 3 left (still the same FY)', monthsLeftInFy('2027-01') === 3);
  ok('months: March → 1 left (the last run)', monthsLeftInFy('2027-03') === 1);
  ok('months: garbage clamps to 1, never 0 or negative', monthsLeftInFy('') === 1 && monthsLeftInFy('2026-99') === 1);

  const b = fyBounds('2026-08');
  ok('fy: August 2026 is FY 2026-27', b.label === 'FY 2026-27' && b.from === '2026-04' && b.to === '2027-03');
  ok('fy: January 2027 is the SAME FY, not 2027-28', fyBounds('2027-01').label === 'FY 2026-27');
  ok('fy: March 2026 belongs to the PREVIOUS FY', fyBounds('2026-03').label === 'FY 2025-26');
  ok('fy: April is the boundary — it starts the new FY', fyBounds('2026-04').label === 'FY 2026-27');

  ok('inFy: April 2026 is in FY 2026-27', isInFy('2026-04', b));
  ok('inFy: March 2027 is in (inclusive)', isInFy('2027-03', b));
  ok('inFy: March 2026 is OUT — last year', !isInFy('2026-03', b));
  ok('inFy: April 2027 is OUT — next year', !isInFy('2027-04', b));
}

/* 2 · THE ORDINARY CASE — a salary that is actually taxable. */
{
  // ₹20L under FY 2026-27 → ₹1,92,400 for the year. Nothing deducted yet, April.
  const apr = cumulativeMonthlyTds({ annualGross: 2000000, regime: 'new', ytdDeducted: 0, monthsRemaining: 12, asOf: FY26 });
  ok('april: annual tax spread over 12', apr.annualTax === 192400 && apr.tds === Math.round(192400 / 12));

  // Four months in, correctly deducted. August must not re-spread the whole year.
  const ytd = Math.round(192400 / 12) * 4;
  const aug = cumulativeMonthlyTds({ annualGross: 2000000, regime: 'new', ytdDeducted: ytd, monthsRemaining: 8, asOf: FY26 });
  ok('august: only the BALANCE is spread, over 8 months', aug.tds === Math.round((192400 - ytd) / 8));
  ok('august: the year still totals correctly', Math.abs(ytd + aug.tds * 8 - 192400) <= 8);
}

/* 3 · THE CORRECTION — an under-deduction is absorbed by the months that remain. */
{
  // Nothing deducted Apr–Jul by mistake. August must catch up, not stay at 1/12.
  const r = cumulativeMonthlyTds({ annualGross: 2000000, regime: 'new', ytdDeducted: 0, monthsRemaining: 8, asOf: FY26 });
  ok('catch-up: full liability over the 8 months left', r.tds === Math.round(192400 / 8));
  ok('catch-up: MORE per month than a naive ÷12', r.tds > Math.round(192400 / 12));
}

/* 4 · OVER-DEDUCTION — the case this whole day was about (AI-N8: never silent). */
{
  // The real scenario: FY 2024-25 slabs deducted ₹3,683/mo on a ₹10L salary Apr–Jul.
  // Under FY 2026-27 law that salary owes ₹0. ₹14,732 is sitting with the society.
  const r = cumulativeMonthlyTds({ annualGross: 1000000, regime: 'new', ytdDeducted: 14732, monthsRemaining: 8, asOf: FY26 });
  ok('over: the year owes ₹0 under the current law', r.annualTax === 0);
  ok('over: remaining months deduct NOTHING', r.tds === 0);
  ok('over: NEVER negative — payroll cannot refund via a deduction', r.tds >= 0);
  ok('over: the excess is REPORTED, not swallowed', r.excess === 14732);
  ok('over: balance is 0, not negative', r.balance === 0);
}

/* 5 · GUARDS — each of these, unguarded, corrupts a real payslip. */
{
  const z = cumulativeMonthlyTds({ annualGross: 2000000, regime: 'new', ytdDeducted: 0, monthsRemaining: 0, asOf: FY26 });
  ok('guard: zero months never divides by zero', Number.isFinite(z.tds) && z.tds === 192400);
  const n = cumulativeMonthlyTds({ annualGross: 2000000, regime: 'new', ytdDeducted: -500, monthsRemaining: -3, asOf: FY26 });
  ok('guard: negative inputs are clamped, not trusted', n.tds === 192400 && n.ytdDeducted === 0);
  const g = cumulativeMonthlyTds({ annualGross: 0, regime: 'new', ytdDeducted: 0, monthsRemaining: 12, asOf: FY26 });
  ok('guard: no salary ⇒ no TDS, no excess', g.tds === 0 && g.excess === 0);
}

/* 6 · asOf IS LOAD-BEARING — the same salary, two years' law. */
{
  const now = cumulativeMonthlyTds({ annualGross: 1000000, regime: 'new', ytdDeducted: 0, monthsRemaining: 12, asOf: FY26 });
  const then = cumulativeMonthlyTds({ annualGross: 1000000, regime: 'new', ytdDeducted: 0, monthsRemaining: 12, asOf: '2024-06-01' });
  ok('asOf: ₹10L owes ₹0 today', now.annualTax === 0);
  ok('asOf: the SAME salary owed ₹44,200 under FY 2024-25 law', then.annualTax === 44200);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
