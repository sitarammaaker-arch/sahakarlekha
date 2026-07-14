// Asset disposal accounting (ECR-15) — imports the REAL src/lib/assetDisposal.ts via the '@/' loader.
// Run: node scripts/test-asset-disposal.mjs
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

const { assetDisposalPosting, assetAcquisitionPosting } = await import(abs('../src/lib/assetDisposal.ts'));

// Pure fixture helper used by the assertions below (not the function under test).
const r2 = (n) => Math.round(n * 100) / 100;
const sum = (lines, t) => r2(lines.filter(l => l.type === t).reduce((s, l) => s + l.amount, 0));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. Profit: cost 100000, accumDep 60000 (WDV 40000), sold 50000 → profit 10000.
const p = assetDisposalPosting({ category: 'Vehicle', cost: 100000, accumDep: 60000, saleProceeds: 50000, cashBankAccount: '3301' });
ok(p.wdv === 40000 && p.gainLoss === 10000, 'WDV 40000, profit 10000');
ok(p.lines.some(l => l.accountId === '3301' && l.type === 'Dr' && l.amount === 50000), 'Dr Cash 50000');
ok(p.lines.some(l => l.accountId === '3110' && l.type === 'Dr' && l.amount === 60000), 'Dr Accum-Dep 60000');
ok(p.lines.some(l => l.accountId === '3104' && l.type === 'Cr' && l.amount === 100000), 'Cr Vehicle cost 100000');
ok(p.lines.some(l => l.accountId === '4410' && l.type === 'Cr' && l.amount === 10000), 'Cr Profit 10000');
ok(sum(p.lines, 'Dr') === sum(p.lines, 'Cr'), 'profit case balances');

// 2. Loss: cost 100000, accumDep 60000 (WDV 40000), sold 30000 → loss 10000.
const l = assetDisposalPosting({ category: 'Vehicle', cost: 100000, accumDep: 60000, saleProceeds: 30000, cashBankAccount: '3301' });
ok(l.gainLoss === -10000, 'loss 10000');
ok(l.lines.some(x => x.accountId === '5406' && x.type === 'Dr' && x.amount === 10000), 'Dr Loss 10000');
ok(!l.lines.some(x => x.accountId === '4410'), 'no profit line on a loss');
ok(sum(l.lines, 'Dr') === sum(l.lines, 'Cr'), 'loss case balances');

// 3. Break-even: proceeds == WDV → no gain/loss line.
const be = assetDisposalPosting({ category: 'Furniture', cost: 50000, accumDep: 20000, saleProceeds: 30000, cashBankAccount: '3302' });
ok(be.gainLoss === 0 && !be.lines.some(x => x.accountId === '4410' || x.accountId === '5406'), 'break-even → no gain/loss line');
ok(sum(be.lines, 'Dr') === sum(be.lines, 'Cr'), 'break-even balances');

// 4. Scrap (0 proceeds): full WDV is a loss.
const scrap = assetDisposalPosting({ category: 'Computer', cost: 40000, accumDep: 25000, saleProceeds: 0, cashBankAccount: '3301' });
ok(scrap.gainLoss === -15000 && !scrap.lines.some(x => x.type === 'Dr' && x.accountId === '3301'), 'scrap: loss = WDV, no cash line');
ok(sum(scrap.lines, 'Dr') === sum(scrap.lines, 'Cr'), 'scrap balances');

// 5. Land (no accum dep account): cost 200000, no dep, sold 250000 → profit 50000, no accum line.
const land = assetDisposalPosting({ category: 'Land', cost: 200000, accumDep: 0, saleProceeds: 250000, cashBankAccount: '3301' });
ok(land.gainLoss === 50000 && land.lines.some(x => x.accountId === '3101' && x.type === 'Cr'), 'land: Cr 3101, profit 50000');
ok(!land.lines.some(x => ['3108','3109','3110','3111','3112'].includes(x.accountId)), 'land has no accum-dep line');
ok(sum(land.lines, 'Dr') === sum(land.lines, 'Cr'), 'land balances');

// 6. accumDep capped at cost (never negative WDV).
const capped = assetDisposalPosting({ category: 'Furniture', cost: 10000, accumDep: 15000, saleProceeds: 2000, cashBankAccount: '3301' });
ok(capped.accumDep === 10000 && capped.wdv === 0 && capped.gainLoss === 2000, 'accumDep capped at cost → WDV 0, all proceeds are profit');

// 7. Acquisition (ECR-15 slice 2): Dr Fixed-Asset (category) / Cr Cash-Bank for cost.
const acq = assetAcquisitionPosting('Vehicle', 100000, '3301');
ok(acq.assetAccount === '3104' && acq.amount === 100000, 'vehicle → Dr 3104');
ok(acq.lines.some(l => l.accountId === '3104' && l.type === 'Dr' && l.amount === 100000), 'Dr Vehicle 100000');
ok(acq.lines.some(l => l.accountId === '3301' && l.type === 'Cr' && l.amount === 100000), 'Cr Cash 100000');
ok(sum(acq.lines, 'Dr') === sum(acq.lines, 'Cr'), 'acquisition balances (Dr = Cr)');
ok(assetAcquisitionPosting('Land', 500000, '3302').assetAccount === '3101', 'land → Dr 3101, Cr bank');
ok(assetAcquisitionPosting('Computer', 0, '3301').amount === 0, 'zero cost → amount 0 (no capitalization)');

console.log(`\nAsset disposal (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
