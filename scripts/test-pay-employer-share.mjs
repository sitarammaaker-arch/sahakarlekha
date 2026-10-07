// Payroll employer share (PF 13% / ESI 3.25%): the formulas, the esi_employer function, parity with the Salary page, the posting legs.
// Run: node scripts/test-pay-employer-share.mjs   (npm run test:pay-employer-share)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

let ER, E, PW, ST, CC, CP, EV, RP;
try {
  ER = await import(abs('../src/lib/pay/statutory/employerShare.ts'));
  E = await import(abs('../src/lib/pay/statutory/esiWage.ts'));
  PW = await import(abs('../src/lib/pay/statutory/pfWage.ts'));
  ST = await import(abs('../src/lib/payrollStatutory.ts'));
  CC = await import(abs('../src/lib/pay/formula/compile.ts'));
  CP = await import(abs('../src/lib/pay/calc/components.ts'));
  EV = await import(abs('../src/lib/pay/formula/evaluator.ts'));
  RP = await import(abs('../src/lib/pay/posting/runPosting.ts'));
} catch (e) { console.error('import failed:', e.message); process.exit(1); }

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.error('  ✗ FAIL:', m); } };
const money = (r) => EV.makeMoney(Math.round(r * 100), 'INR');
const erEsi = (wage, paidDays, month = '2026-10') => ER.makeEsiEmployer({ asOf: `${month}-01`, currency: 'INR' })(money(wage), paidDays).minor / 100;

console.log('\n1. esi_employer — limit, rate, NO daily-wage exemption');
ok(erEsi(16000, 30) === 520, 'wage ₹16,000 → 3.25% = ₹520');
ok(erEsi(21000, 30) === 682.5, 'wage exactly ₹21,000 (the limit) is covered → ₹682.50');
ok(erEsi(21000.01, 30) === 0 && erEsi(100000, 30) === 0 && erEsi(0, 30) === 0, 'above the limit / no wage → 0');
ok(erEsi(5000, 30) === 162.5, 'average daily wage ₹166.67 (≤ ₹176): the employee share is waived but the EMPLOYER still pays 3.25% = ₹162.50');
ok(E.makeEsiEmployee({ asOf: '2026-10-01', currency: 'INR' })(money(5000), 30).minor === 0, '…while the employee share for the same wage is 0 (the two functions really differ)');

console.log('\n2. parity with the Salary page (computeStatutory)');
{
  let n = 0, bad = 0;
  for (let wage = 5400; wage <= 21000; wage += 137) {
    const s = ST.computeStatutory({ asOf: '2026-10-01', basic: wage, allowances: 0, pfApplicable: false, esiApplicable: true }).esiEmployer;
    const p = erEsi(wage, 30);
    n++; if (Math.abs(s - p) > 0.0049) { bad++; console.error(`    wage ${wage}: Salary ${s} ≠ Payroll ${p}`); }
  }
  ok(bad === 0, `${n} wages: Payroll's employer ESI equals the Salary page's every time`);
  let nb = 0, bb = 0;
  for (let basic = 25000; basic <= 40000; basic += 997) {
    const pf = PW.makePfWage({ asOf: '2026-10-01', currency: 'INR' })(money(basic * 1.2)).minor;
    const p = Math.round(pf * 13 / 100) / 100;
    const s = ST.computeStatutory({ asOf: '2026-10-01', basic, allowances: 0, pfApplicable: true, esiApplicable: false }).pfEmployer;
    // PF bases differ by design (Salary: basic only; Payroll: basic + DA, per the Act) — compared only where both sit at the ceiling
    nb++; if (Math.abs(s - p) > 0.0149) { bb++; console.error(`    basic ${basic}: Salary ${s} ≠ Payroll ${p}`); }
  }
  ok(bb === 0 && nb > 0, `${nb} wages at the ceiling: employer PF 13% equals the Salary page's`);
}

console.log('\n3. the formulas compile and run through the real engine');
const FIX = { BASIC: 'Money', CONSOLIDATED: 'Money', STIPEND: 'Money', DEP_ALLOW: 'Money' };
const src = readFileSync(pathResolve(HERE, '..', 'supabase/functions/pay-employee/index.ts'), 'utf8');
const f = (code) => src.match(new RegExp('^\\s*' + code + ":\\s*'(formula \"" + code + "\"[^\\n]*)',\\s*$", 'm'))[1];
function run(catalog, fixed, lop, month = '2026-10', erRate = 13) {
  const fns = { [PW.PF_WAGE_NAME]: PW.PF_WAGE_SIG, [ER.ESI_EMPLOYER_NAME]: ER.ESI_EMPLOYER_SIG };
  const set = CC.compileFormulaCatalog(catalog, { vars: { ...FIX, attendance: 'Map', tax: 'Map', employer_pf_total_rate: 'Number' }, fns });
  return CP.runComponents(set, {
    facts: { attendance: { paidDays: 30 - lop, lopDays: lop, otHours: 0 }, leave: [], loan: [], tax: { ytdByHead: {}, monthsRemaining: 6, regime: 'new' } },
    currency: 'INR', fixedComponents: Object.fromEntries(Object.entries(fixed).map(([k, v]) => [k, money(v)])),
    fns: { [PW.PF_WAGE_NAME]: PW.makePfWage({ asOf: `${month}-01`, currency: 'INR' }), [ER.ESI_EMPLOYER_NAME]: ER.makeEsiEmployer({ asOf: `${month}-01`, currency: 'INR' }) },
    scalars: { employer_pf_total_rate: erRate },
  }).values;
}
const val = (o, k) => (o[k] ? o[k].minor / 100 : 0);
{
  const pf = [{ code: 'ER_PF', source: ER.ER_FORMULAS.ER_PF }];
  ok(val(run(pf, { BASIC: 10000 }, 0), 'ER_PF') === 1560, 'basic ₹10,000 → PF wage ₹12,000 → 13% = ₹1,560');
  ok(val(run(pf, { BASIC: 30000 }, 0), 'ER_PF') === 3250, 'basic ₹30,000 → capped at the ₹25,000 ceiling (October 2026) → 13% = ₹3,250');
  ok(val(run(pf, { BASIC: 10000 }, 3), 'ER_PF') === 1404, '3 days of loss of pay: 27/30 of ₹1,560 = ₹1,404 (same fraction as the employee PF)');
  ok(val(run(pf, { BASIC: 30000 }, 0, '2026-08'), 'ER_PF') === 1950, 'August 2026: the ceiling is still ₹15,000 → 13% = ₹1,950 (dated, read for the month paid)');
  const perm = [{ code: 'DA', source: f('DA') }, { code: 'HRA', source: f('HRA') }, { code: 'LOP', source: f('LOP') }, { code: 'ER_ESI', source: ER.ER_FORMULAS.ER_ESI }];
  ok(val(run(perm, { BASIC: 10000 }, 0), 'ER_ESI') === 520, 'permanent: gross ₹16,000 → employer ESI ₹520');
  ok(val(run(perm, { BASIC: 20000 }, 0), 'ER_ESI') === 0, 'permanent: gross ₹32,000 is above the limit → 0');
  const nohra = [{ code: 'DA', source: f('DA') }, { code: 'LOP_NOHRA', source: f('LOP_NOHRA') }, { code: 'ER_ESI_NOHRA', source: ER.ER_FORMULAS.ER_ESI_NOHRA }];
  ok(val(run(nohra, { BASIC: 12000 }, 0), 'ER_ESI_NOHRA') === 468, 'seasonal / fixed-term: ₹14,400 → ₹468');
  const dep = [{ code: 'DA', source: f('DA') }, { code: 'LOP_DEP', source: f('LOP_DEP') }, { code: 'ER_ESI_DEP', source: ER.ER_FORMULAS.ER_ESI_DEP }];
  ok(val(run(dep, { BASIC: 10000, DEP_ALLOW: 2000 }, 0), 'ER_ESI_DEP') === 455, 'deputation: ₹14,000 → ₹455');
  const con = [{ code: 'LOP_CONSOL', source: f('LOP_CONSOL') }, { code: 'ER_ESI_CONSOL', source: ER.ER_FORMULAS.ER_ESI_CONSOL }];
  ok(val(run(con, { CONSOLIDATED: 15000 }, 0), 'ER_ESI_CONSOL') === 487.5, 'contract: ₹15,000 → ₹487.50');
  const stp = [{ code: 'LOP_STIPEND', source: f('LOP_STIPEND') }, { code: 'ER_ESI_STIPEND', source: ER.ER_FORMULAS.ER_ESI_STIPEND }];
  ok(val(run(stp, { STIPEND: 9000 }, 0), 'ER_ESI_STIPEND') === 292.5, 'apprentice: ₹9,000 → ₹292.50');
}

console.log('\n4. codes — the ER_ family is never mistaken for the employee ESI / PF');
ok(Object.keys(ER.ER_FORMULAS).every((c) => ER.isErCode(c)) && !ER.isErCode('PF') && !ER.isErCode('ESI') && !ER.isErCode('ER_X'), 'isErCode recognises exactly ER_PF, ER_ESI, ER_ESI_*');
ok(Object.keys(ER.ER_FORMULAS).every((c) => !E.isEsiCode(c)), 'no ER_ code is matched by isEsiCode (so none can be listed or booked as the employee ESI)');
ok(Object.values(ER.ER_ESI_CODE_BY_TYPE).every((c) => c in ER.ER_FORMULAS), 'every employment type maps to a defined employer ESI formula');
ok(Object.keys(E.ESI_CODE_BY_TYPE).join() === Object.keys(ER.ER_ESI_CODE_BY_TYPE).join() && !('muster' in ER.ER_ESI_CODE_BY_TYPE), 'same employment types as the employee ESI; daily-wage types have none');

console.log('\n5. posting — bucket by CODE, legs, balance, missing heads');
ok(RP.bucketOf('ER_PF', 'employer_contrib') === 'er_pf' && RP.bucketOf('ER_ESI_NOHRA', 'employer_contrib') === 'er_esi', 'ER_PF / ER_ESI* employer_contrib lines get their own buckets');
ok(RP.bucketOf('DAILY_RATE', 'employer_contrib') === 'ignore', 'DAILY_RATE (also kind employer_contrib) is still ignored');
ok(RP.bucketOf('ER_PF', 'deduction') !== 'er_pf', 'an ER_PF code that is somehow a deduction is NOT booked as the employer share');
const H = { salaryExpense: '5201', salaryPayable: '2103', pfPayable: '2203', esiPayable: '2204', pfEmployerExpense: '5203', esiEmployerExpense: '5204', ptPayable: '2207', tdsPayable: '2202' };
const L = (code, kind, amountMinor) => ({ code, kind, amountMinor });
const id = (() => { let i = 0; return () => 'l' + ++i; })();
{
  const lines = [L('BASIC', 'earning', 1000000), L('PF', 'deduction', 120000), L('ER_PF', 'employer_contrib', 130000), L('ESI', 'deduction', 7500), L('ER_ESI', 'employer_contrib', 32500)];
  const net = 1000000 - 120000 - 7500;
  const r = RP.buildRunAccrual(lines, net, H, id);
  ok(r.ok, 'a run with employer lines posts');
  const leg = (acc, dc) => r.legs.filter((g) => g.accountId === acc && g.drCr === dc).reduce((s, g) => s + g.amountMinor, 0);
  ok(leg('5201', 'Dr') === 1000000, 'salary expense is unchanged (the employer share is a SEPARATE expense head)');
  ok(leg('5203', 'Dr') === 130000 && leg('5204', 'Dr') === 32500, 'Dr 5203 PF ₹1,300 and Dr 5204 ESI ₹325');
  ok(leg('2203', 'Cr') === 250000, 'Cr EPF payable = employee ₹1,200 + employer ₹1,300 in ONE leg (one challan, as the Salary page books it)');
  ok(leg('2204', 'Cr') === 40000, 'Cr ESI payable = employee ₹75 + employer ₹325');
  ok(leg('2103', 'Cr') === net, 'net salary payable is unchanged — the employee net does not move');
  const dr = r.legs.filter((g) => g.drCr === 'Dr').reduce((s, g) => s + g.amountMinor, 0), cr = r.legs.filter((g) => g.drCr === 'Cr').reduce((s, g) => s + g.amountMinor, 0);
  ok(dr === cr && dr === 1162500, `the voucher balances to the paisa (Dr = Cr = ${dr})`);
}
{
  const lines = [L('BASIC', 'earning', 1000000), L('ER_PF', 'employer_contrib', 130000)];
  const r = RP.buildRunAccrual(lines, 1000000, { ...H, pfEmployerExpense: undefined }, id);
  ok(!r.ok && r.code === 'PAY-POST-HEAD' && r.missingHeads.includes('pf.employer_expense'), 'no pf.employer_expense role → REFUSED with a clear message, never booked half');
  const r2 = RP.buildRunAccrual(lines, 1000000, { ...H, pfPayable: undefined }, id);
  ok(!r2.ok && r2.missingHeads.includes('pf.payable'), 'employer PF with no pf.payable head → refused (the liability needs a home)');
  const r3 = RP.buildRunAccrual([L('BASIC', 'earning', 1000000), L('DAILY_RATE', 'employer_contrib', 50000)], 1000000, H, id);
  ok(r3.ok && r3.legs.length === 2, 'a run with only a hidden daily-rate input books exactly as before (2 legs)');
  const r4 = RP.buildRunAccrual([L('BASIC', 'earning', 1000000), L('PF', 'deduction', 120000)], 880000, H, id);
  ok(r4.ok && r4.legs.length === 3, 'a run WITHOUT employer lines books exactly as before (no new legs)');
}
ok(RP.PAYROLL_ROLES.pfEmployerExpense === 'pf.employer_expense' && RP.PAYROLL_ROLES.esiEmployerExpense === 'esi.employer_expense', 'the roles are the ones already seeded in account_roles');
{
  const h = RP.headsFromRoles([{ role: 'pf.employer_expense', account_id: '5203' }, { role: 'esi.employer_expense', account_id: '5204' }]);
  ok(h.pfEmployerExpense === '5203' && h.esiEmployerExpense === '5204', 'headsFromRoles reads both employer-expense roles');
}

console.log('\n6. wiring — pay-run supplies the function + the dated rate; the bundle has the code; nothing is bound yet');
const run_ = readFileSync(pathResolve(HERE, '..', 'supabase/functions/pay-run/index.ts'), 'utf8');
ok(/ESI_EMPLOYER_NAME\]: makeEsiEmployer\(/.test(run_) && /ESI_EMPLOYER_NAME\]: ESI_EMPLOYER_SIG/.test(run_), 'pay-run supplies esi_employer and declares its signature');
ok(/\[ER_PF_RATE_VAR\]: resolveParam\('pf\.employerRate', periodMonth\)\.value/.test(run_), 'pay-run seeds employer_pf_total_rate from the dated pf.employerRate (a society row still wins)');
const bundle = readFileSync(pathResolve(HERE, '..', 'supabase/functions/_shared/pay-core.mjs'), 'utf8');
ok(/makeEsiEmployer/.test(bundle) && /ER_FORMULAS/.test(bundle) && /er_pf/.test(bundle), 'the committed pay-core.mjs bundle contains the employer-share code');
ok(/ER_FORMULAS/.test(src), 'pay-employee knows the ER_ formulas (the switch is tested in section 7)');
console.log('\n7. the switch (er-set) and the payslip line — step 3');
ok(/ER_FORMULAS/.test(src) && /kind: 'employer_contrib', method: 'formula'/.test(src), 'pay-employee defines the ER_ components in the society catalog (kind employer_contrib)');
ok(/body.action === 'er-set'/.test(src) && /only admin may turn the employer share/.test(src), 'er-set exists and is admin-only');
ok(/pf.employer_expense/.test(src) && /esi.employer_expense/.test(src) && /status: 409/.test(src), 'er-set REFUSES to turn on when the employer-expense account role is missing (the post would be refused later)');
ok(/hasPf/.test(src) && /hasEsi/.test(src), 'the employer share is bound only where the employee has PF / ESI of their own');
ok(/as er_codes/.test(src), 'list returns er_codes so the screen shows the state');
{
  const i = src.indexOf("body.action === 'esi-set'"), j = src.indexOf("body.action === 'er-set'");
  ok(/ER_ESI_CODE_BY_TYPE/.test(src.slice(i, j)), 'turning ESI off also removes the employer ESI companion');
}
const run2 = readFileSync(pathResolve(HERE, '..', 'supabase/functions/pay-run/index.ts'), 'utf8');
ok(run2.includes('...(ps.payslip.employerContributions ?? [])'), 'pay-run persists the employer lines (the ledger reads payslip_line)');
const page = readFileSync(pathResolve(HERE, '..', 'src/pages/Payroll.tsx'), 'utf8');
ok((page.match(/l.kind !== 'employer_contrib'/g) || []).length === 2, 'the payslip screen and the ECR export both filter the employer lines out (they must never show as an earning)');
ok(/action: 'er-set'/.test(page), 'the Payroll page has the switch');
{
  const PS = await import(abs('../src/lib/pay/calc/payslip.ts'));
  ok(['ER_PF', 'ER_ESI', 'ER_ESI_NOHRA', 'ER_ESI_DEP', 'ER_ESI_CONSOL', 'ER_ESI_STIPEND', 'DAILY_RATE', 'PF', 'ESI', 'ESI_NOHRA', 'ER_X'].every((c) => PS.isEmployerShareCode(c) === ER.isErCode(c)), 'payslip.isEmployerShareCode and employerShare.isErCode agree on every code');
  const m = (r) => EV.makeMoney(Math.round(r * 100), 'INR');
  const vals = { BASIC: m(10000), PF: m(1200), ER_PF: m(1560.4), DAILY_RATE: m(500) };
  const slip = PS.aggregatePayslip(vals, { currency: 'INR', classification: { BASIC: 'earning', PF: 'deduction', ER_PF: 'info', DAILY_RATE: 'info' } });
  ok(slip.netPay.minor === 880000 && slip.grossEarnings.minor === 1000000 && slip.grossDeductions.minor === 120000, 'the employee gross / deductions / net are UNCHANGED by an employer line');
  ok(slip.employerContributions?.length === 1 && slip.employerContributions[0].code === 'ER_PF' && slip.employerContributions[0].amount.minor === 156000, 'ER_PF is carried, rounded to whole rupees (₹1,560.40 → ₹1,560); DAILY_RATE (also info) is not');
  const none = PS.aggregatePayslip({ BASIC: m(10000) }, { currency: 'INR', classification: { BASIC: 'earning' } });
  ok(none.employerContributions === undefined, 'a payslip with no employer component is exactly as before (no new field)');
}


console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
