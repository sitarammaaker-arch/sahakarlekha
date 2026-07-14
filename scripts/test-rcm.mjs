// RCM auto-compute (ECR-22 slice B) — imports the REAL src/lib/rcm.ts (via the '@/' loader)
// so this validates the actual code. (Was a self-contained mirror before.)
// Run: node scripts/test-rcm.mjs
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

const { computeRCM } = await import(abs('../src/lib/rcm.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const FROM = '2026-04-01', TO = '2027-03-31';

const purchases = [
  // RCM, supplier charged no GST → self-assess 18% intra (9+9) on 10,000.
  { date: '2026-05-01', netAmount: 10000, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, cgstPct: 9, sgstPct: 9, rcmApplicable: true },
  // RCM, GST already recorded (IGST 900) → use as-is.
  { date: '2026-06-01', netAmount: 5000, cgstAmount: 0, sgstAmount: 0, igstAmount: 900, igstPct: 18, rcmApplicable: true },
  // NOT RCM → excluded.
  { date: '2026-06-10', netAmount: 20000, cgstAmount: 1800, sgstAmount: 1800, igstAmount: 0, rcmApplicable: false },
  // RCM but deleted → excluded.
  { date: '2026-06-15', netAmount: 3000, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, cgstPct: 9, sgstPct: 9, rcmApplicable: true, isDeleted: true },
  // RCM but out of FY → excluded.
  { date: '2025-06-01', netAmount: 9999, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, cgstPct: 9, sgstPct: 9, rcmApplicable: true },
];
const s = computeRCM(purchases, FROM, TO);

ok(s.count === 2, 'only 2 RCM purchases counted (non-RCM, deleted, out-of-FY excluded)');
ok(s.taxableValue === 15000, 'RCM taxable value = 10000 + 5000');
ok(s.cgst === 900 && s.sgst === 900, 'intra self-assessed 9%+9% on 10,000');
ok(s.igst === 900, 'recorded IGST used as-is');
ok(s.total === 2700, 'total RCM tax = 900+900+900 (payable in cash AND claimable as ITC)');

// Empty / no RCM.
ok(computeRCM([{ date: '2026-05-01', netAmount: 100, cgstAmount: 9, sgstAmount: 9, igstAmount: 0 }], FROM, TO).total === 0, 'no RCM-flagged purchase → 0');

console.log(`\nRCM (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
