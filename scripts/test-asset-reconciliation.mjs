// Asset-register ↔ ledger reconciliation (ECR-05, asset side) — imports the REAL
// src/lib/assetReconciliation.ts (which imports @/lib/money) via the '@/' loader.
// Run: node scripts/test-asset-reconciliation.mjs
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

const { sumActiveAssetCost, reconcileAssetRegister } = await import(abs('../src/lib/assetReconciliation.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. sumActiveAssetCost — excludes archived and disposed.
{
  const assets = [
    { cost: 100000 },                              // live
    { cost: 50000, disposalDate: '2026-05-01' },   // disposed → excluded (credited out of ledger)
    { cost: 30000, isDeleted: true },              // archived → excluded
    { cost: 20000 },                               // live
  ];
  ok(sumActiveAssetCost(assets) === 120000, 'Σ live-non-disposed cost = 100000 + 20000 = 120000');
  ok(sumActiveAssetCost([]) === 0, 'empty → 0');
  ok(sumActiveAssetCost(null) === 0, 'null → 0');
}

// 2. reconcileAssetRegister — matched within tolerance.
{
  const r = reconcileAssetRegister(120000, 120000);
  ok(r.reconciled && r.difference === 0, 'register == ledger → reconciled, diff 0');
}

// 3. Drift detected (register has an asset the ledger never got a voucher for).
{
  const r = reconcileAssetRegister(120000, 100000);
  ok(!r.reconciled && r.difference === 20000, 'register > ledger by 20000 → drift flagged');
}

// 4. Sub-rupee difference is within tolerance (reconciled).
{
  const r = reconcileAssetRegister(120000.40, 120000);
  ok(r.reconciled && r.difference === 0.4, '₹0.40 rounding diff → still reconciled');
}
// ₹1 or more is a real drift.
{
  const r = reconcileAssetRegister(120001, 120000);
  ok(!r.reconciled && r.difference === 1, '₹1 diff → NOT reconciled');
}

// 5. Negative drift (ledger > register — e.g. an opening balance not in the register).
{
  const r = reconcileAssetRegister(100000, 120000);
  ok(!r.reconciled && r.difference === -20000, 'ledger > register → negative drift');
}

console.log(`\nAsset reconciliation (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
