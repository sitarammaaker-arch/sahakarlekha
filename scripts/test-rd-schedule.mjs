// RD installment schedule (Deposits module). Imports the REAL src/lib/rdSchedule.ts via the
// '@/' loader (was a self-contained mirror before).
// Run: node scripts/test-rd-schedule.mjs
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

const { addMonths, monthsBetween, buildRdSchedule, missedCount } = await import(abs('../src/lib/rdSchedule.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. addMonths — month/year rollover + day clamp.
ok(addMonths('2024-04-15', 1) === '2024-05-15', 'add 1 month');
ok(addMonths('2024-12-10', 1) === '2025-01-10', 'rolls over the year');
ok(addMonths('2024-01-31', 1) === '2024-02-29', 'clamps to Feb (leap year)');
ok(addMonths('2025-01-31', 1) === '2025-02-28', 'clamps to Feb (non-leap)');

// 2. monthsBetween.
ok(monthsBetween('2024-04-01', '2025-04-01') === 12, '12-month term');
ok(monthsBetween('2024-04-01', '2024-10-01') === 6, '6-month term');

// 3. A 12-month RD, 6 installments paid → 6 paid, then missed/due by as-of.
const sch = buildRdSchedule({ openDate: '2024-04-01', installmentAmount: 1000, maturityDate: '2025-04-01', totalPaid: 6000, asOf: '2024-11-15' });
ok(sch.length === 12, '12 installments generated');
ok(sch.filter(s => s.status === 'paid').length === 6, '6 installments paid (6000/1000)');
ok(sch[0].dueDate === '2024-04-01' && sch[11].dueDate === '2025-03-01', 'due dates run monthly from openDate');
// installment 7 due 2024-10-01 (< asOf 2024-11-15) → missed; installment 8 due 2024-11-01 (< asOf) → missed; 9 due 2024-12-01 → due.
ok(sch[6].status === 'missed' && sch[7].status === 'missed', 'unpaid past-due installments are missed');
ok(sch[8].status === 'due', 'unpaid future installment is due');
ok(missedCount(sch) === 2, 'exactly 2 missed');

// 4. Fully paid → none missed.
const paid = buildRdSchedule({ openDate: '2024-04-01', installmentAmount: 1000, maturityDate: '2025-04-01', totalPaid: 12000, asOf: '2025-05-01' });
ok(paid.every(s => s.status === 'paid') && missedCount(paid) === 0, 'all paid → none missed');

// 5. Missing config → empty schedule.
ok(buildRdSchedule({ openDate: '2024-04-01', installmentAmount: 0, maturityDate: '2025-04-01', totalPaid: 0, asOf: '2024-05-01' }).length === 0, 'no installment amount → empty');
ok(buildRdSchedule({ openDate: '2024-04-01', installmentAmount: 1000, maturityDate: undefined, totalPaid: 0, asOf: '2024-05-01' }).length === 0, 'no maturity date → empty');

console.log(`\nRD schedule (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
