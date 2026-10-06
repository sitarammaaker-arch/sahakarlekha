// Payroll PF wage cap (pf_wage): PF follows the dated EPFO ceiling, split by days in September 2026.
// Run: node scripts/test-pay-pf-wage.mjs   (npm run test:pay-pf-wage)

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


let P, CC, CP, EV;
try {
  P = await import(abs('../src/lib/pay/statutory/pfWage.ts'));
  CC = await import(abs('../src/lib/pay/formula/compile.ts'));
  CP = await import(abs('../src/lib/pay/calc/components.ts'));
  EV = await import(abs('../src/lib/pay/formula/evaluator.ts'));
} catch (e) { console.error('import failed:', e.message); process.exit(1); }

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.error('  ✗ FAIL:', m); } };
const money = (r) => EV.makeMoney(Math.round(r * 100), 'INR');

// the formula text the server seeds — read from pay-employee itself so a drift in either place fails here
const src = readFileSync(pathResolve(HERE, '..', 'supabase/functions/pay-employee/index.ts'), 'utf8');
const m = src.match(/^\s*PF:\s*'(formula "PF"[^\n]*)',\s*$/m);
if (!m) { console.error('cannot find the PF formula in pay-employee'); process.exit(1); }
const PF_FORMULA = m[1];

const typeBase = { vars: { BASIC: 'Money', pf_rate: 'Number', attendance: 'Map' }, fns: { [P.PF_WAGE_NAME]: P.PF_WAGE_SIG } };
const set = CC.compileFormulaCatalog([{ code: 'PF', source: PF_FORMULA }], typeBase);
function pf(basicRupees, month, lopDays = 0) {
  const out = CP.runComponents(set, {
    facts: { attendance: { paidDays: 30 - lopDays, lopDays, otHours: 0 }, leave: [], loan: [], tax: { ytdByHead: {}, monthsRemaining: 12, regime: 'new' } },
    currency: 'INR', fixedComponents: { BASIC: money(basicRupees) },
    fns: { [P.PF_WAGE_NAME]: P.makePfWage({ asOf: `${month}-01`, currency: 'INR' }) },
    scalars: { pf_rate: 12 },
  });
  return out.values.PF.minor / 100;
}
const wage = (w, month) => P.makePfWage({ asOf: `${month}-01`, currency: 'INR' })(money(w)).minor / 100;

console.log('\n1. the formula compiles with the whitelisted pf_wage and keeps the paid-days factor');
ok(PF_FORMULA.includes('pf_wage(BASIC * 120%)'), 'the server formula caps the basic+DA wage through pf_wage()');
ok(pf(10000, '2026-08') === 1440, 'basic ₹10,000, August 2026: wage ₹12,000 → PF ₹1,440 (under the ceiling, unchanged)');
ok(pf(10000, '2026-08', 3) === 1296, 'three days loss of pay: ₹1,440 × 27/30 = ₹1,296');

console.log('\n2. before 17 Sept 2026 the ceiling is ₹15,000');
ok(wage(30000, '2026-08') === 15000, 'wage ₹30,000 in August → ₹15,000');
ok(pf(25000, '2026-08') === 1800, 'basic ₹25,000 (wage ₹30,000), August → PF ₹1,800 (was ₹3,600 with no ceiling)');
ok(wage(15000, '2026-08') === 15000 && wage(14999, '2026-08') === 14999, 'at and just under the ceiling: no cut');

console.log('\n3. September 2026 — 16 days on ₹15,000, 14 days on ₹25,000 (EPFO FAQ Q7/Q13)');
ok(wage(25000, '2026-09') === 19666.67, 'wage ₹25,000 → 15,000×16/30 + 25,000×14/30 = ₹19,666.67');
ok(wage(20000, '2026-09') === 17333.33, 'wage ₹20,000 → 8,000 + 9,333.33 = ₹17,333.33');
ok(wage(12000, '2026-09') === 12000, 'wage ₹12,000 → under both ceilings, ₹12,000');
ok(wage(60000, '2026-09') === 19666.67, 'wage ₹60,000 → capped in both parts, ₹19,666.67');
ok(Math.abs(pf(25000 / 1.2, '2026-09') - 2360) < 0.01, 'wage ₹25,000 through the formula: PF ₹2,360.00');

console.log('\n4. from October 2026 the ceiling is ₹25,000');
ok(wage(30000, '2026-10') === 25000, 'wage ₹30,000 in October → ₹25,000');
ok(pf(25000, '2026-10') === 3000, 'basic ₹25,000 (wage ₹30,000), October → PF ₹3,000');
ok(pf(25000, '2026-10', 3) === 2700, 'with three loss-of-pay days: ₹3,000 × 27/30 = ₹2,700');
ok(wage(30000, '2027-03') === 25000, 'a later month stays on the newest row');

console.log('\n5. refusals');
try { P.makePfWage({ asOf: '2026-10-01', currency: 'INR' })(5); ok(false, 'a bare number is refused'); } catch (e) { ok(/PAY-DSL-TYPE-015/.test(e.message), 'a bare number is refused (PAY-DSL-TYPE-015)'); }
try { P.makePfWage({ asOf: '2026-10-01', currency: 'INR' })(EV.makeMoney(100, 'USD')); ok(false, 'currency mismatch'); } catch (e) { ok(/PAY-DSL-TYPE-011/.test(e.message), 'wrong currency is refused (PAY-DSL-TYPE-011)'); }

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
