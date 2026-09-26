// Loan Interest default period — local dates (no UTC shift) + Indian FY for "annual".
// Runs in Asia/Kolkata, where the old toISOString() code shifted every date one day back.
// Run: node scripts/test-loan-interest-period.mjs
process.env.TZ = 'Asia/Kolkata';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath } from 'node:url';
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('.') && !/\\.(ts|tsx|js|mjs|json)$/.test(spec)) {
      const u = new URL(spec + '.ts', ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true };
    }
    return next(spec, ctx);
  }
`));
const { interestPeriodDefaults } = await import(pathToFileURL(pathResolve(ROOT, 'src/lib/loans/interestPeriod.ts')).href);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Guard: the test really runs where the old bug showed (IST midnight = previous day in UTC).
ok(new Date(2026, 8, 1).toISOString().startsWith('2026-08-31'), 'TZ is Asia/Kolkata (old code would give 31-08)');

const at = (y, m1, d) => new Date(y, m1 - 1, d, 10, 0, 0);
ok(same(interestPeriodDefaults('monthly', at(2026, 9, 26)), { from: '2026-09-01', to: '2026-09-30' }), 'September → 01-09 … 30-09 (not 31-08 … 29-09)');
ok(same(interestPeriodDefaults('monthly', at(2027, 2, 10)), { from: '2027-02-01', to: '2027-02-28' }), 'February (non-leap) → 28th');
ok(same(interestPeriodDefaults('monthly', at(2028, 2, 10)), { from: '2028-02-01', to: '2028-02-29' }), 'February (leap) → 29th');
ok(same(interestPeriodDefaults('monthly', at(2026, 12, 31)), { from: '2026-12-01', to: '2026-12-31' }), 'December → 31st, same year');
ok(same(interestPeriodDefaults('monthly', at(2026, 9, 1)), { from: '2026-09-01', to: '2026-09-30' }), 'first day of the month');
ok(same(interestPeriodDefaults('quarterly', at(2026, 9, 26)), { from: '2026-07-01', to: '2026-09-30' }), 'Q Jul–Sep');
ok(same(interestPeriodDefaults('quarterly', at(2027, 1, 5)), { from: '2027-01-01', to: '2027-03-31' }), 'Q Jan–Mar');
ok(same(interestPeriodDefaults('annual', at(2026, 9, 26)), { from: '2026-04-01', to: '2027-03-31' }), 'annual in September → FY 2026-27');
ok(same(interestPeriodDefaults('annual', at(2027, 2, 10)), { from: '2026-04-01', to: '2027-03-31' }), 'annual in February → still FY 2026-27 (was 2027-28)');
ok(same(interestPeriodDefaults('annual', at(2027, 4, 1)), { from: '2027-04-01', to: '2028-03-31' }), 'annual on 1 April → new FY');

// Every month of two years: from is the 1st, to is the real last day, never a UTC-shifted date.
let bad = 0;
for (let y = 2026; y <= 2027; y++) for (let m = 1; m <= 12; m++) {
  const r = interestPeriodDefaults('monthly', at(y, m, 15));
  const last = new Date(y, m, 0).getDate();
  if (r.from !== `${y}-${String(m).padStart(2, '0')}-01` || r.to !== `${y}-${String(m).padStart(2, '0')}-${last}`) bad++;
}
ok(bad === 0, `24 months: correct first/last day (${bad} wrong)`);

const page = readFileSync(pathResolve(ROOT, 'src/pages/LoanInterest.tsx'), 'utf8');
ok(/interestPeriodDefaults\(mode\)/.test(page) && !/toISOString\(\)\.split\('T'\)\[0\]/.test(page), 'page uses the shared helper; no toISOString date-building left');

console.log(`loan interest period: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
