// Deleted-movement archival (ECR-21). Imports the REAL src/lib/movementArchive.ts via the
// '@/' loader — so this validates the actual code. (Was a self-contained mirror before.)
// Run: node scripts/test-movement-archive.mjs
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

const { snapshotDeletedMovements } = await import(abs('../src/lib/movementArchive.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Maps the audit-relevant fields, drops everything else (rate/amount/godownId/narration).
{
  const movs = [
    { id: 'm1', itemId: 'i1', type: 'sale', qty: 5, referenceNo: 'SL/1', date: '2026-04-01', rate: 44, amount: 220, narration: 'x', godownId: 'g1' },
    { id: 'm2', itemId: 'i2', type: 'purchase', qty: 10, referenceNo: 'PUR/1', date: '2026-04-02' },
  ];
  const snap = snapshotDeletedMovements(movs);
  ok(snap.length === 2, 'snapshots all movements');
  ok(JSON.stringify(snap[0]) === JSON.stringify({ id: 'm1', itemId: 'i1', type: 'sale', qty: 5, referenceNo: 'SL/1', date: '2026-04-01' }), 'keeps id/itemId/type/qty/referenceNo/date only');
  ok(!('rate' in snap[0]) && !('amount' in snap[0]) && !('godownId' in snap[0]), 'drops rate/amount/godownId/narration');
}

// 2. Empty / null guards.
ok(snapshotDeletedMovements([]).length === 0, 'empty → []');
ok(snapshotDeletedMovements(null).length === 0, 'null → []');
ok(snapshotDeletedMovements(undefined).length === 0, 'undefined → []');

// 3. Missing optional referenceNo preserved as undefined.
{
  const snap = snapshotDeletedMovements([{ id: 'm', itemId: 'i', type: 'adjustment', qty: -2, date: '2026-05-01' }]);
  ok(snap[0].referenceNo === undefined && snap[0].qty === -2, 'no referenceNo → undefined; negative qty preserved');
}

console.log(`\nMovement archive (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
