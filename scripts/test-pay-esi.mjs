// Payroll ESI (employee share): the esi_employee function, its five formulas, parity with the Salary page, and the wiring.
// Run: node scripts/test-pay-esi.mjs   (npm run test:pay-esi)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

// '@/'-resolving loader — the same one test-payroll-statutory.mjs uses.
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



let E, ST, CC, CP, EV, RP;
try {
  E = await import(abs('../src/lib/pay/statutory/esiWage.ts'));
  ST = await import(abs('../src/lib/payrollStatutory.ts'));
  CC = await import(abs('../src/lib/pay/formula/compile.ts'));
  CP = await import(abs('../src/lib/pay/calc/components.ts'));
  EV = await import(abs('../src/lib/pay/formula/evaluator.ts'));
  RP = await import(abs('../src/lib/pay/posting/runPosting.ts'));
} catch (e) { console.error('import failed:', e.message); process.exit(1); }

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.error('  ✗ FAIL:', m); } };
const money = (r) => EV.makeMoney(Math.round(r * 100), 'INR');
const esi = (wage, paidDays, month = '2026-10') => E.makeEsiEmployee({ asOf: `${month}-01`, currency: 'INR' })(money(wage), paidDays).minor / 100;

console.log('\n1. the function — limit, daily exemption, rate');
ok(esi(16000, 30) === 120, 'wage ₹16,000 → 0.75% = ₹120');
ok(esi(21000, 30) === 157.5, 'wage exactly ₹21,000 (the limit) is covered → ₹157.50');
ok(esi(21000.01, 30) === 0, 'wage ₹21,000.01 is above the limit → 0');
ok(esi(100000, 30) === 0, 'wage ₹1,00,000 → 0');
ok(esi(0, 30) === 0, 'no wage → 0');
ok(esi(5000, 30) === 0, 'average daily wage ₹166.67 (≤ ₹176) → the employee share is waived');
ok(esi(5280, 30) === 0, 'average daily wage exactly ₹176 → waived');
ok(esi(5310, 30) === 39.83, 'average daily wage just above ₹176 → 0.75% of ₹5,310 = ₹39.83');
ok(esi(3000, 15) === 22.5, '₹3,000 over 15 paid days (₹200/day) is NOT exempt → ₹22.50');

console.log('\n2. parity with the Salary page (computeStatutory) — same wage, same ESI, paisa for paisa');
{
  let n = 0, bad = 0;
  for (let wage = 5400; wage <= 21000; wage += 137) {   // above the ₹176/day exemption, up to the limit
    const s = ST.computeStatutory({ asOf: '2026-10-01', basic: wage, allowances: 0, pfApplicable: false, esiApplicable: true }).esiEmployee;
    const p = esi(wage, 30);
    n++; if (Math.abs(s - p) > 0.0049) { bad++; console.error(`    wage ${wage}: Salary ${s} ≠ Payroll ${p}`); }
  }
  ok(bad === 0, `${n} wages from ₹5,400 to ₹21,000: Payroll's ESI equals the Salary page's every time`);
  const above = ST.computeStatutory({ asOf: '2026-10-01', basic: 21500, allowances: 0, pfApplicable: false, esiApplicable: true }).esiEmployee;
  ok(above === 0 && esi(21500, 30) === 0, 'above the limit both give 0');
}

console.log('\n3. the five formulas compile and run through the real engine');
const src = readFileSync(pathResolve(HERE, '..', 'supabase/functions/pay-employee/index.ts'), 'utf8');
const f = (code) => src.match(new RegExp("^\\s*" + code + ":\\s*'(formula \"" + code + "\"[^\\n]*)',\\s*$", 'm'))[1];
const FIX = { BASIC: 'Money', CONSOLIDATED: 'Money', STIPEND: 'Money', DEP_ALLOW: 'Money' };
function run(catalog, fixed, lop, paid = 30 - lop, month = '2026-10') {
  const set = CC.compileFormulaCatalog(catalog, { vars: { ...FIX, attendance: 'Map', tax: 'Map', pf_rate: 'Number' }, fns: { [E.ESI_EMPLOYEE_NAME]: E.ESI_EMPLOYEE_SIG } });
  return CP.runComponents(set, {
    facts: { attendance: { paidDays: paid, lopDays: lop, otHours: 0 }, leave: [], loan: [], tax: { ytdByHead: {}, monthsRemaining: 6, regime: 'new' } },
    currency: 'INR', fixedComponents: Object.fromEntries(Object.entries(fixed).map(([k, v]) => [k, money(v)])),
    fns: { [E.ESI_EMPLOYEE_NAME]: E.makeEsiEmployee({ asOf: `${month}-01`, currency: 'INR' }) }, scalars: { pf_rate: 12 },
  }).values;
}
const val = (o, k) => (o[k] ? o[k].minor / 100 : 0);
{
  const perm = [{ code: 'DA', source: f('DA') }, { code: 'HRA', source: f('HRA') }, { code: 'LOP', source: f('LOP') }, { code: 'ESI', source: E.ESI_FORMULAS.ESI }];
  ok(val(run(perm, { BASIC: 10000 }, 0), 'ESI') === 120, 'permanent: basic ₹10,000 → gross ₹16,000 → ESI ₹120');
  ok(val(run(perm, { BASIC: 10000 }, 3), 'ESI') === 108, 'permanent with 3 days loss of pay: earned ₹14,400 → ESI ₹108');
  ok(val(run(perm, { BASIC: 20000 }, 0), 'ESI') === 0, 'permanent: gross ₹32,000 is above the limit → 0');
  ok(val(run(perm, { BASIC: 20000 }, 11), 'ESI') > 0, 'permanent: a long absence brings the EARNED wage under the limit (₹32,000 − ₹11,733.33 ≈ ₹20,267) → ESI applies');
  const nohra = [{ code: 'DA', source: f('DA') }, { code: 'LOP_NOHRA', source: f('LOP_NOHRA') }, { code: 'ESI_NOHRA', source: E.ESI_FORMULAS.ESI_NOHRA }];
  ok(val(run(nohra, { BASIC: 12000 }, 0), 'ESI_NOHRA') === 108, 'seasonal / fixed-term: basic ₹12,000 + DA ₹2,400 = ₹14,400 → ESI ₹108');
  const dep = [{ code: 'DA', source: f('DA') }, { code: 'LOP_DEP', source: f('LOP_DEP') }, { code: 'ESI_DEP', source: E.ESI_FORMULAS.ESI_DEP }];
  ok(val(run(dep, { BASIC: 10000, DEP_ALLOW: 2000 }, 0), 'ESI_DEP') === 105, 'deputation: basic ₹10,000 + DA ₹2,000 + allowance ₹2,000 = ₹14,000 → ESI ₹105');
  const con = [{ code: 'LOP_CONSOL', source: f('LOP_CONSOL') }, { code: 'ESI_CONSOL', source: E.ESI_FORMULAS.ESI_CONSOL }];
  ok(val(run(con, { CONSOLIDATED: 15000 }, 0), 'ESI_CONSOL') === 112.5, 'contract: consolidated ₹15,000 → ESI ₹112.50');
  const stp = [{ code: 'LOP_STIPEND', source: f('LOP_STIPEND') }, { code: 'ESI_STIPEND', source: E.ESI_FORMULAS.ESI_STIPEND }];
  ok(val(run(stp, { STIPEND: 9000 }, 0), 'ESI_STIPEND') === 67.5, 'apprentice: stipend ₹9,000 → ESI ₹67.50');
}

console.log('\n4. wiring — the code maps, the posting bucket, the server, the bundle');
ok(Object.keys(E.ESI_FORMULAS).every((c) => E.isEsiCode(c)) && !E.isEsiCode('PF') && !E.isEsiCode('ESIGHT') && !E.isEsiCode('ESIX'), 'isEsiCode recognises exactly ESI and ESI_*');
ok(Object.values(E.ESI_CODE_BY_TYPE).every((c) => c in E.ESI_FORMULAS), 'every employment type maps to a defined ESI formula');
ok(!('muster' in E.ESI_CODE_BY_TYPE) && !('casual' in E.ESI_CODE_BY_TYPE), 'daily-wage types have no automatic ESI');
ok(['ESI', 'ESI_NOHRA', 'ESI_DEP', 'ESI_CONSOL', 'ESI_STIPEND'].every((c) => RP.bucketOf(c, 'deduction') === 'esi'), 'all five post to the ESI-payable bucket');
ok(RP.bucketOf('ESIGHT', 'deduction') === 'other_deduction', 'an unrelated code starting with ESI… is not swept into ESI payable (only ESI / ESI_*)');
ok(/'esi-set'/.test(src) && /ESI_FORMULAS/.test(src) && /ESI_CODE_BY_TYPE/.test(src), 'pay-employee has the esi-set action and the ESI components');
const run_ = readFileSync(pathResolve(HERE, '..', 'supabase/functions/pay-run/index.ts'), 'utf8');
ok(/ESI_EMPLOYEE_NAME\]: makeEsiEmployee\(/.test(run_) && /ESI_EMPLOYEE_NAME\]: ESI_EMPLOYEE_SIG/.test(run_), 'pay-run supplies esi_employee and declares its signature');
const bundle = readFileSync(pathResolve(HERE, '..', 'supabase/functions/_shared/pay-core.mjs'), 'utf8');
ok(/makeEsiEmployee/.test(bundle) && /ESI_FORMULAS/.test(bundle), 'the committed pay-core.mjs bundle contains the ESI code');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
