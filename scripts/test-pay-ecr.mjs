// PF ECR row building. What goes into a statutory file has to be testable, so the row builder is a
// pure function and this proves the parts that are easy to get wrong: the §6 wage base (basic + DA),
// the paid-days proportion EPFO expects, who is filed at all, and that a day count stays a whole
// number now that pay can be pro-rated to a fraction of a month.
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
// A realistic member: basic + DA (20% of basic) is the §6 PF wage base; PF echoed as computed.
const member = (over = {}) => {
  const basic = over.basic ?? 1500000;
  const da = over.da ?? Math.round(basic * 0.2);
  const pf = over.pf ?? Math.round((basic + da) * 0.12);
  return {
    employeeCode: 'E1', name: 'Test', uan: '100200300400', grossMinor: 2400000, paidDays: 30,
    lines: [{ code: 'BASIC', computedMinor: basic }, { code: 'DA', computedMinor: da }, { code: 'PF', computedMinor: pf }],
    ...over,
  };
};
const cols = (row) => row.split('#~#');

// 1. a full-month member — the baseline row. EPF wages are basic + DA, not basic alone.
{
  const r = ecr.buildEcr([member()], RATES);
  eq(r.rows.length, 1, 'one row');
  const c = cols(r.rows[0]);
  eq(c.length, 11, 'eleven fields');
  eq(c[0], '100200300400', 'UAN');
  eq(c[3], '18000', 'EPF wages = basic 15000 + DA 3000');
  eq(c[4], '15000', 'EPS wages capped at the ceiling');
  eq(c[6], '2160', 'employee EPF = 12% of 18000');
  eq(c[7], '1250', 'EPS = 8.33% of capped wages');
  eq(c[8], '911', 'EPF−EPS employer difference');
  eq(c[9], '0', 'NCP zero for a full month');
  eq(r.partMonth.length, 0, 'not flagged part-month');
}

// 2. wages above the EPS ceiling — EPS on the capped figure, EPF wages (basic+DA) not capped
{
  const r = ecr.buildEcr([member({ basic: 2500000 })], RATES);   // basic 25000 + DA 5000 = 30000
  const c = cols(r.rows[0]);
  eq(c[3], '30000', 'EPF wages uncapped = basic + DA');
  eq(c[4], '15000', 'EPS wages capped');
  eq(c[7], '1250', 'EPS still on the ceiling');
  eq(c[8], '2351', 'difference is employer 12% of 30000 less EPS');
}

// 3. EPF wages follow the PAID portion of the month, and NCP stays a WHOLE number
{
  const r = ecr.buildEcr([member({ paidDays: 14.52 })], RATES);   // joined mid-month, 18000 base
  const c = cols(r.rows[0]);
  eq(c[3], '8712', 'EPF wages reduced to the paid days (18000 × 14.52/30)');
  eq(c[9], '15', 'fractional paid days round to a whole NCP');
  ok(!c[9].includes('.'), 'NCP carries no decimal point');
  eq(r.partMonth.length, 1, 'flagged as part-month');
}
{
  const r = ecr.buildEcr([member({ paidDays: 27 })], RATES);      // three days absent
  const c = cols(r.rows[0]);
  eq(c[3], '16200', 'EPF wages for 27 of 30 days');
  eq(c[9], '3', 'ordinary absence gives NCP 3');
}
{
  const r = ecr.buildEcr([member({ paidDays: 0 })], RATES);
  const c = cols(r.rows[0]);
  eq(c[3], '0', 'no days paid gives no EPF wages');
  eq(c[9], '30', 'no days paid gives NCP 30');
}
{
  const r = ecr.buildEcr([member({ paidDays: 31 })], RATES);      // a 31-day month entered as worked
  const c = cols(r.rows[0]);
  eq(c[3], '18000', 'paid days over 30 clamp to the full base');
  eq(c[9], '0', 'NCP never goes negative');
}

// 4. someone with no PF component is not an EPF member and must not be filed at all
{
  const r = ecr.buildEcr([
    { employeeCode: 'DW1', name: 'Daily', uan: 'u', grossMinor: 1100000, paidDays: 22, lines: [{ code: 'DAILY_WAGE', computedMinor: 1100000 }] },
    { employeeCode: 'AP1', name: 'Appr', uan: 'u', grossMinor: 800000, paidDays: 30, lines: [{ code: 'STIPEND', computedMinor: 800000 }] },
    member({ employeeCode: 'PM1' }),
  ], RATES);
  eq(r.rows.length, 1, 'only the EPF member is filed');
  eq(r.skippedNoPf.join(','), 'DW1,AP1', 'the other two are reported as skipped');
  eq(cols(r.rows[0])[3], '18000', 'the filed row is the permanent employee, basic + DA');
}

// 5. a PF line pinned to zero IS filed — that is the admin's declaration, not our inference
{
  const r = ecr.buildEcr([member({ pf: 0 })], RATES);
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
