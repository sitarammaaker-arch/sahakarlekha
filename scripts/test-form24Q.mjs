// Form 24Q — quarterly salary TDS return (ECR-14) — imports the REAL src/lib/form24Q.ts via the '@/' loader.
// Run: node scripts/test-form24Q.mjs
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

const { quarterMonths, build24Q } = await import(abs('../src/lib/form24Q.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. Quarter month mapping (FY straddles the calendar year at Q4).
ok(JSON.stringify(quarterMonths('2024-25', 'Q1')) === JSON.stringify(['2024-04', '2024-05', '2024-06']), 'Q1 = Apr–Jun');
ok(JSON.stringify(quarterMonths('2024-25', 'Q4')) === JSON.stringify(['2025-01', '2025-02', '2025-03']), 'Q4 = Jan–Mar of next year');

const emps = [
  { id: 'e1', empNo: 'E002', name: 'Sita', pan: 'ABCDE1234F' },
  { id: 'e2', empNo: 'E001', name: 'Ravi', pan: '' },
];
const recs = [
  { employeeId: 'e1', month: '2024-04', basicSalary: 50000, allowances: 5000, tds: 3000 },
  { employeeId: 'e1', month: '2024-05', basicSalary: 50000, allowances: 5000, tds: 3000 },
  { employeeId: 'e2', month: '2024-06', basicSalary: 20000, allowances: 0, tds: 0 },
  { employeeId: 'e1', month: '2024-07', basicSalary: 50000, allowances: 5000, tds: 3000 }, // Q2 — excluded from Q1
];

// 2. Q1 aggregation: e1 two months, e2 one; e1's July excluded.
const q1 = build24Q(recs, emps, '2024-25', 'Q1');
ok(q1.rows.length === 2, 'two deductees in Q1');
ok(q1.rows[0].empNo === 'E001' && q1.rows[1].empNo === 'E002', 'rows sorted by empNo');
const sita = q1.rows.find(r => r.name === 'Sita');
ok(sita.grossSalary === 110000 && sita.tds === 6000, 'Sita Q1 gross 110000 + TDS 6000 (2 months, July excluded)');
ok(q1.totals.tds === 6000 && q1.totals.deductees === 2, 'Q1 totals');
ok(sita.pan === 'ABCDE1234F' && q1.rows.find(r => r.name === 'Ravi').pan === '', 'PAN carried (blank when missing)');

// 3. Q2 has only e1's July record.
const q2 = build24Q(recs, emps, '2024-25', 'Q2');
ok(q2.rows.length === 1 && q2.totals.tds === 3000, 'Q2 = single July record');

// 4. Empty quarter.
const q3 = build24Q(recs, emps, '2024-25', 'Q3');
ok(q3.rows.length === 0 && q3.totals.tds === 0 && q3.totals.deductees === 0, 'empty quarter → no rows');

console.log(`\nForm 24Q (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
