// Attendance pro-ration (ECR-14) — imports the REAL src/lib/attendance.ts via the '@/' loader.
// Run: node scripts/test-attendance.mjs
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

const { daysInMonth, clampPaidDays, prorate } = await import(abs('../src/lib/attendance.ts'));

// Pure fixture helper used by the assertions below (not the function under test).
const r2 = (n) => Math.round(n * 100) / 100;

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
