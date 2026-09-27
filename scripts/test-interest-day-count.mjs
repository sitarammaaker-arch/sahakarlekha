// Interest day count (NABARD PACS RFP §16.1.2): period days include both ends (every calendar day
// counted once across consecutive periods), and the society's year basis ('365' default / 'actual'
// / '360') drives loan, KCC and SB interest — with '365' byte-identical to the old formula.
// Run: node scripts/test-interest-day-count.mjs
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath, pathToFileURL } from 'node:url';
  import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !/\\.(ts|tsx|js|mjs|json)$/.test(spec)) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
`));
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const D = await imp('src/lib/interestDayCount.ts');
const I = await imp('src/lib/loans/interestAccrual.ts');
const { sbInterest, simpleInterest: depSimple } = await imp('src/lib/depositInterest.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// ── Period days: both ends included ──
ok(D.periodDays('2026-09-01', '2026-09-30') === 30, 'September = 30 days (the old to − from gave 29)');
ok(D.periodDays('2026-04-01', '2027-03-31') === 365 && D.periodDays('2027-04-01', '2028-03-31') === 366, 'FY = 365 / 366 days');
ok(D.periodDays('2026-09-30', '2026-09-01') === 0 && D.periodDays('', '2026-09-01') === 0, 'reversed / empty ⇒ 0');
{
  let sum = 0;
  for (let m = 0; m < 12; m++) {
    const y = m < 9 ? 2026 : 2027, mm = ((m + 3) % 12) + 1;
    const last = new Date(Date.UTC(y, mm, 0)).getUTCDate();
    sum += D.periodDays(`${y}-${String(mm).padStart(2, '0')}-01`, `${y}-${String(mm).padStart(2, '0')}-${last}`);
  }
  ok(sum === 365, `12 consecutive monthly periods count every day of the FY once (${sum})`);
}

// ── Year fraction ──
ok(near(D.yearFraction('2026-09-30', 30), 30 / 365) && near(D.yearFraction('2026-09-30', 30, '360'), 30 / 360), "'365' (default) and '360'");
ok(near(D.yearFraction('2028-02-29', 29, 'actual'), 29 / 366) && near(D.yearFraction('2027-02-28', 28, 'actual'), 28 / 365), "'actual': leap year over 366, other years over 365");
ok(near(D.yearFraction('2028-01-15', 30, 'actual'), 15 / 365 + 15 / 366), "'actual' across 1 January: each part over its own year");
ok(D.asDayCount('actual') === 'actual' && D.asDayCount(undefined) === '365' && D.asDayCount('bogus') === '365', 'unset / unknown setting ⇒ 365');

// ── Loans: '365' is byte-identical; other bases follow the setting ──
{
  const loans = [{ id: 'L1', loanNo: 'L-1', memberId: 'm', amount: 100000, repaidAmount: 12345.67, interestRate: 7.25, dueDate: '2030-01-01', status: 'active' }];
  const old = I.simpleInterest(100000 - 12345.67, 7.25, 30);
  ok(I.accrualRows(loans, '2026-09-30', 30)[0].interest === old && I.accrualRows(loans, '2026-09-30', 30, '365')[0].interest === old, "default / '365' accrual = the historical formula, to the paisa");
  const act = I.accrualRows(loans, '2028-02-29', 29, 'actual')[0].interest;
  ok(act === Math.round(87654.33 * 0.0725 * (29 / 366) * 100) / 100, `'actual' in a leap year uses 366 (${act})`);
  ok(I.accrualRows(loans, '2026-09-30', 30, '360')[0].interest === Math.round(87654.33 * 0.0725 * (30 / 360) * 100) / 100, "'360'");
}
// ── SB ──
ok(sbInterest(50000, 4, 90) === depSimple(50000, 4, 90) && sbInterest(50000, 4, 90, '365', '2026-06-30') === depSimple(50000, 4, 90), "SB default / '365' unchanged");
ok(sbInterest(36000, 4, 90, '360', '2026-06-30') === 360, "SB '360': 36,000 × 4% × 90/360 = 360");

ok(D.yearDaysLabel('365') === '365' && D.yearDaysLabel('360') === '360' && /366/.test(D.yearDaysLabel('actual')) && /वास्तविक/.test(D.yearDaysLabel('actual', true)), 'formula label follows the basis');
// ── Wiring ──
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const li = read('src/pages/LoanInterest.tsx');
ok(/const daysBetween = \(a: string, b: string\): number => periodDays\(a, b\);/.test(li), 'Loan Interest page counts days with both ends included');
ok(/accrualRows\(activeLoans, toDate, days, basis(, interestRoom)?\)/.test(li) && /accrualRows\(kccAccruables\(kccLoans\), toDate, days, basis(, interestRoom)?\)/.test(li) && /asDayCount\(society\.interestDayCount\)/.test(li), 'member loans and KCC use the society basis');
ok(/sbInterest\(intAcct\.balance, intAcct\.interestRate \|\| 0, Number\(days\) \|\| 0, asDayCount\(society\.interestDayCount\), intDate\)/.test(read('src/pages/Deposits.tsx')), 'SB interest uses the society basis');
ok(/updateSociety\(\{ interestDayCount: v \}\)/.test(read('src/pages/SocietySetup.tsx')), 'setting saved via updateSociety (missing column trimmed + reported, RULE 1)');
const mig = read('supabase/migrations/071_interest_day_count.sql');
ok(/add column if not exists "interestDayCount" text/.test(mig) && /in \('365', 'actual', '360'\)/.test(mig) && /"interestDayCount" text/.test(read('supabase-tables.sql')), 'migration 071 (+ supabase-tables.sql): nullable column, checked values');
ok(/drop column if exists "interestDayCount"/.test(read('supabase/migrations/071_interest_day_count_down.sql')), 'down migration');

ok(!/\/ \(365 [x×] 100\)/.test(li) && (li.match(/yearDaysLabel\(basis/g) || []).length === 3, 'Loan Interest formula text (screen + PDF) shows the society basis, never a hard-coded 365');
console.log(`Interest day count: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
