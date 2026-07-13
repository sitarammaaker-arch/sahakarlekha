// Deposit interest calculators (Deposits module — SB/FD/RD).
// Imports the REAL src/lib/depositInterest.ts (which imports @/lib/money) via an
// '@/'-resolving loader — the actual engine, not a mirror.
// Run: node scripts/test-deposit-interest.mjs

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

const { simpleInterest, sbInterest, fdInterest, fdMaturityValue, rdInterest, rdMaturityValue } = await import(abs('../src/lib/depositInterest.ts'));
const r2 = (n) => Math.round(n * 100) / 100; // for expected-value comparisons only

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. Simple interest: 10000 @ 6% for 365 days = 600.
ok(simpleInterest(10000, 6, 365) === 600, '10000 @ 6% for a year = 600');
ok(simpleInterest(10000, 6, 90) === r2(600 * 90 / 365), '90-day interest is pro-rata');
ok(simpleInterest(0, 6, 90) === 0 && simpleInterest(10000, 0, 90) === 0, 'zero principal/rate → 0');

// 2. SB is simple interest on the balance.
ok(sbInterest(50000, 4, 90) === simpleInterest(50000, 4, 90), 'SB == simple interest');

// 3. FD: 100000 @ 7% for 12 months = 7000 interest, 107000 maturity.
ok(fdInterest(100000, 7, 12) === 7000, 'FD 1-year interest');
ok(fdMaturityValue(100000, 7, 12) === 107000, 'FD maturity = principal + interest');
ok(fdInterest(100000, 7, 6) === 3500, 'FD 6-month interest is half');

// 4. RD: R=1000, 12 months @ 6%.  Σ interest = 1000 × (0.06/12) × (12×13/2) = 1000×0.005×78 = 390.
ok(rdInterest(1000, 6, 12) === 390, 'RD 12-month interest = 390');
ok(rdMaturityValue(1000, 6, 12) === 12390, 'RD maturity = 12000 installments + 390 interest');
ok(rdInterest(1000, 0, 12) === 0, 'RD zero-rate interest = 0');

// 5. Rounding to 2dp.
ok(simpleInterest(12345, 7.25, 37) === r2(12345 * 0.0725 * 37 / 365), 'fractional interest rounds to 2dp');

console.log(`\nDeposit interest (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
