// PF ECR row building. What goes into a statutory file has to be testable, so the row builder is a
// pure function and this proves the parts that are easy to get wrong: who is filed at all, and that
// a day count stays a whole number now that pay can be pro-rated to a fraction of a month.
//
// Run: node scripts/test-pay-ecr.mjs   (npm run test:pay-ecr)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let ecr;
try {
  ecr = await import(abs('../src/lib/pay/filing/ecr.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}

let pass = 0, fail = 0;
const ok = (cond, what) => { if (cond) { pass++; } else { fail++; console.error('  ✗', what); } };
const eq = (got, want, what) => ok(got === want, `${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const RATES = { epsRate: 8.33, employerPfRate: 12, epsWageCeilingMinor: 1500000 };
const member = (over) => ({
  employeeCode: 'E1', name: 'Test', uan: '100200300400',
  grossMinor: 2400000, paidDays: 30,
  lines: [{ code: 'BASIC', computedMinor: 1500000 }, { code: 'PF', computedMinor: 180000 }],
  ...over,
});
const cols = (row) => row.split('#~#');

// 1. a full-month member — the baseline row
{
  const r = ecr.buildEcr([member()], RATES);
  eq(r.rows.length, 1, 'one row');
  const c = cols(r.rows[0]);
  eq(c.length, 11, 'eleven fields');
  eq(c[0], '100200300400', 'UAN');
  eq(c[3], '15000', 'EPF wages = basic');
  eq(c[4], '15000', 'EPS wages capped at the ceiling');
  eq(c[6], '1800', 'employee EPF');
  eq(c[7], '1250', 'EPS = 8.33% of capped wages');
  eq(c[8], '551', 'EPF minus EPS employer difference, 550.50 rounded');
  eq(c[9], '0', 'NCP zero for a full month');
  eq(r.partMonth.length, 0, 'not flagged part-month');
}

// 2. wages above the EPS ceiling — EPS is on the capped figure, EPF wages are not capped
{
  const r = ecr.buildEcr([member({ lines: [{ code: 'BASIC', computedMinor: 2500000 }, { code: 'PF', computedMinor: 300000 }] })], RATES);
  const c = cols(r.rows[0]);
  eq(c[3], '25000', 'EPF wages uncapped');
  eq(c[4], '15000', 'EPS wages capped');
  eq(c[7], '1250', 'EPS still on the ceiling');
  eq(c[8], '1751', 'difference is employer 12% of 25000 less EPS, 1750.50 rounded');
}

// 3. NCP must be a WHOLE number even though pay is pro-rated to fractions of a month
{
  const r = ecr.buildEcr([member({ paidDays: 14.52 })], RATES);   // joined mid-month
  const c = cols(r.rows[0]);
  eq(c[9], '15', 'fractional paid days round to a whole NCP');
  ok(!c[9].includes('.'), 'NCP carries no decimal point');
  eq(r.partMonth.length, 1, 'flagged as part-month');
}
{
  const r = ecr.buildEcr([member({ paidDays: 27 })], RATES);      // three days absent
  eq(cols(r.rows[0])[9], '3', 'ordinary absence gives NCP 3');
}
{
  const r = ecr.buildEcr([member({ paidDays: 0 })], RATES);
  eq(cols(r.rows[0])[9], '30', 'no days paid gives NCP 30');
}
{
  const r = ecr.buildEcr([member({ paidDays: 31 })], RATES);      // a 31-day month entered as worked
  eq(cols(r.rows[0])[9], '0', 'NCP never goes negative');
}

// 4. someone with no PF component is not an EPF member and must not be filed at all
{
  const r = ecr.buildEcr([
    member({ employeeCode: 'DW1', lines: [{ code: 'DAILY_WAGE', computedMinor: 1100000 }] }),   // daily wager
    member({ employeeCode: 'AP1', lines: [{ code: 'STIPEND', computedMinor: 800000 }] }),        // apprentice
    member({ employeeCode: 'PM1' }),                                                             // permanent
  ], RATES);
  eq(r.rows.length, 1, 'only the EPF member is filed');
  eq(r.skippedNoPf.join(','), 'DW1,AP1', 'the other two are reported as skipped');
  eq(cols(r.rows[0])[3], '15000', 'the filed row is the permanent employee');
}

// 5. a PF line pinned to zero IS filed — that is the admin's declaration, not our inference
{
  const r = ecr.buildEcr([member({ lines: [{ code: 'BASIC', computedMinor: 1500000 }, { code: 'PF', computedMinor: 0 }] })], RATES);
  eq(r.rows.length, 1, 'zero PF is still a member');
  eq(cols(r.rows[0])[6], '0', 'employee EPF zero');
  eq(r.skippedNoPf.length, 0, 'not skipped');
}

// 6. a member without a UAN is named, because the portal will reject that row
{
  const r = ecr.buildEcr([member({ employeeCode: 'NU1', uan: '' })], RATES);
  eq(r.missingUan.join(','), 'NU1', 'missing UAN reported');
  eq(r.rows.length, 1, 'the row is still produced for the admin to see');
}

console.log(`${fail ? 'FAIL' : 'PASS'}  pay ECR — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
