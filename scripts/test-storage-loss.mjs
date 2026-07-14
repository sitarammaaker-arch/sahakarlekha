// Storage-loss vs norm (ECR-20) — imports the REAL src/lib/storageLoss.ts (via the '@/' loader)
// so this validates the actual code. (Was a self-contained mirror before.)
// Run: node scripts/test-storage-loss.mjs
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

const { computeStorageLoss } = await import(abs('../src/lib/storageLoss.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Basic loss %: 100 in, 3 lost → 3%.
{
  const rows = computeStorageLoss([
    { itemId: 'A', type: 'purchase', qty: 100 },
    { itemId: 'A', type: 'adjustment', qty: -3 },
  ], 2);
  const a = rows[0];
  ok(a.inwardQty === 100 && a.lossQty === 3 && a.actualLossPct === 3, '100 in, 3 loss → 3%');
  ok(!a.withinNorm && a.excessPct === 1, '3% vs 2% norm → excess 1%, not within');
}
// 2. Within norm.
{
  const a = computeStorageLoss([{ itemId: 'A', type: 'purchase', qty: 100 }, { itemId: 'A', type: 'adjustment', qty: -1 }], 2)[0];
  ok(a.withinNorm && a.excessPct === 0, '1% vs 2% norm → within, no excess');
}
// 3. Sales are NOT loss.
{
  const a = computeStorageLoss([{ itemId: 'A', type: 'purchase', qty: 100 }, { itemId: 'A', type: 'sale', qty: 40 }], 2)[0];
  ok(a.lossQty === 0 && a.actualLossPct === 0, 'sale is not storage loss');
}
// 4. Transfer legs (TRF/) excluded from BOTH inward and loss.
{
  const rows = computeStorageLoss([
    { itemId: 'A', type: 'purchase', qty: 100 },
    { itemId: 'A', type: 'adjustment', qty: -50, referenceNo: 'TRF/1' }, // OUT leg — relocation
    { itemId: 'A', type: 'adjustment', qty: 50, referenceNo: 'TRF/1' },  // IN leg
    { itemId: 'A', type: 'adjustment', qty: -2 },                        // real loss
  ], 5);
  const a = rows[0];
  ok(a.inwardQty === 100 && a.lossQty === 2, 'transfer legs excluded; real loss counted');
}
// 5. Positive adjustment counts as inward (stock gain / found).
{
  const a = computeStorageLoss([{ itemId: 'A', type: 'opening', qty: 50 }, { itemId: 'A', type: 'adjustment', qty: 10 }, { itemId: 'A', type: 'adjustment', qty: -6 }], 5)[0];
  ok(a.inwardQty === 60 && a.lossQty === 6 && a.actualLossPct === 10, 'opening + positive adj = inward 60; loss 6 → 10%');
}
// 6. Deleted movements excluded.
{
  const a = computeStorageLoss([{ itemId: 'A', type: 'purchase', qty: 100 }, { itemId: 'A', type: 'adjustment', qty: -9, isDeleted: true }], 2)[0];
  ok(a.lossQty === 0, 'deleted movement ignored');
}
// 7. No inward → row omitted (no meaningful %).
{
  const rows = computeStorageLoss([{ itemId: 'A', type: 'adjustment', qty: -5 }], 2);
  ok(rows.length === 0, 'no inward throughput → no row');
}
// 8. Norm 0 → any loss is excess.
{
  const a = computeStorageLoss([{ itemId: 'A', type: 'purchase', qty: 100 }, { itemId: 'A', type: 'adjustment', qty: -1 }], 0)[0];
  ok(!a.withinNorm && a.excessPct === 1, 'norm 0 → 1% loss is excess');
}

console.log(`\nStorage loss (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
