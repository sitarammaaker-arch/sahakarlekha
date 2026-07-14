// Unified statutory reconciliation (ECR-14). Imports the REAL src/lib/statutoryReconciliation.ts
// via the '@/' loader (was a self-contained mirror before).
// Run: node scripts/test-statutory-reconciliation.mjs
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

const { reconcileStatutory, salariedRow, labourRow } = await import(abs('../src/lib/statutoryReconciliation.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const r2 = (n) => Math.round(n * 100) / 100; // fixture rounding for expected values

// Salaried: 2 employees.
const sal = salariedRow([
  { basicSalary: 20000, allowances: 5000, pfEmployee: 1800, pfEmployer: 1800, esiEmployee: 0, esiEmployer: 0 },
  { basicSalary: 12000, allowances: 3000, pfEmployee: 1080, pfEmployer: 1080, esiEmployee: 112, esiEmployer: 487 },
]);
ok(sal.gross === 40000, 'salaried gross = Σ(basic+allow) = 40000');
ok(sal.pfEmployee === 2880 && sal.pfEmployer === 2880, 'salaried PF emp/er summed');
ok(sal.count === 2, 'salaried count = 2');

// Labour from computePfEsi output (5 workers).
const lab = labourRow({ grossWages: 60000, epfEmployee: 7200, epfEmployer: 7200, esiEmployee: 450, esiEmployer: 1950 }, 5);
ok(lab.gross === 60000 && lab.pfEmployee === 7200, 'labour row maps grossWages/epf');
ok(lab.count === 5, 'labour worker count = 5');

// Combined reconciliation.
const rec = reconcileStatutory([sal, lab]);
ok(rec.totals.gross === 100000, 'combined gross = 40000 + 60000');
ok(rec.totals.pfEmployee === 10080 && rec.totals.pfEmployer === 10080, 'combined PF split');
ok(rec.totals.pfTotal === 20160, 'PF challan total = emp + er');
ok(rec.totals.esiTotal === r2(112 + 487 + 450 + 1950), 'ESI total = emp + er across both');
ok(rec.totals.count === 7, 'combined headcount = 2 + 5');
ok(rec.rows.length === 2, 'two source rows preserved');

// Empty period → all zeros, no crash.
const empty = reconcileStatutory([salariedRow([]), labourRow({}, 0)]);
ok(empty.totals.gross === 0 && empty.totals.pfTotal === 0 && empty.totals.count === 0, 'empty period → zeros');

console.log(`\nStatutory reconciliation (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
