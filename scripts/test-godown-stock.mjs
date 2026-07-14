// Godown-wise stock (ECR-17 Phase 3). Imports the REAL src/lib/godownStock.ts via the '@/'
// loader (was a self-contained mirror before).
// Run: node scripts/test-godown-stock.mjs
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

const { UNASSIGNED_GODOWN, computeGodownStock, godownTotals } = await import(abs('../src/lib/godownStock.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const r2 = (n) => Math.round(n * 100) / 100; // fixture rounding for expected values
const get = (rows, item, godown) => rows.find(r => r.itemId === item && r.godownId === godown);

const mv = [
  { itemId: 'wheat', type: 'purchase', qty: 100, rate: 20, godownId: 'g1', date: '2026-05-01' },
  { itemId: 'wheat', type: 'sale',     qty: 30,  rate: 25, godownId: 'g1', date: '2026-06-01' },
  { itemId: 'wheat', type: 'purchase', qty: 50,  rate: 22, godownId: 'g2', date: '2026-06-05' },
  { itemId: 'rice',  type: 'purchase', qty: 40,  rate: 30, godownId: 'g1', date: '2026-06-10' },
  { itemId: 'rice',  type: 'purchase', qty: 10,  rate: 30, date: '2026-06-11' }, // no godown → unassigned
  { itemId: 'wheat', type: 'adjustment', qty: -5, godownId: 'g1', date: '2026-07-01' }, // shrinkage
];
const rows = computeGodownStock(mv);

// 1. Wheat in g1: 100 − 30 − 5 = 65.
ok(get(rows, 'wheat', 'g1').qty === 65, 'wheat g1 qty = 100 − 30 − 5 = 65');
// 2. Wheat in g2: 50 (separate godown, not merged with g1).
ok(get(rows, 'wheat', 'g2').qty === 50, 'wheat g2 qty = 50 (per-godown, not merged)');
// 3. Value at weighted-avg inward cost (g1 wheat: only inward @20 → 65 × 20 = 1300).
ok(get(rows, 'wheat', 'g1').value === 1300, 'wheat g1 value = 65 × 20 = 1300');
ok(get(rows, 'wheat', 'g2').value === 1100, 'wheat g2 value = 50 × 22 = 1100');
// 4. Rice split across g1 (40) and unassigned (10).
ok(get(rows, 'rice', 'g1').qty === 40, 'rice g1 = 40');
ok(get(rows, 'rice', UNASSIGNED_GODOWN).qty === 10, 'rice unassigned = 10 (no-godown bucket)');
// 5. Per-godown totals.
const totals = godownTotals(rows);
ok(totals.g1 === r2(1300 + 40 * 30), 'g1 total value = wheat 1300 + rice 1200 = 2500');
ok(totals.g2 === 1100, 'g2 total = 1100');
// 6. asOf excludes later movements (before the sale → wheat g1 = 100).
const early = computeGodownStock(mv, '2026-05-15');
ok(get(early, 'wheat', 'g1').qty === 100, 'asOf 2026-05-15 → wheat g1 = 100 (pre-sale)');
// 7. Deleted movement ignored.
const withDel = computeGodownStock([...mv, { itemId: 'wheat', type: 'purchase', qty: 999, godownId: 'g1', isDeleted: true }]);
ok(get(withDel, 'wheat', 'g1').qty === 65, 'deleted movement ignored');

console.log(`\nGodown stock (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
