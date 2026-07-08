// Asset disposal accounting (ECR-15) — mirrors src/lib/assetDisposal.ts.
// Run: node scripts/test-asset-disposal.mjs

const r2 = (n) => Math.round(n * 100) / 100;
const ASSET_ACCOUNTS = { Land: '3101', Building: '3102', Furniture: '3103', Vehicle: '3104', Equipment: '3105', Other: '3106', Computer: '3107' };
const ACCUM_DEP_ACCOUNTS = { Building: '3108', Furniture: '3109', Vehicle: '3110', Equipment: '3111', Computer: '3112', Other: '3112' };
const PROFIT_ON_SALE = '4410', LOSS_ON_SALE = '5406';
function assetDisposalPosting(input) {
  const cost = r2(Math.max(0, input.cost || 0));
  const accumDep = r2(Math.min(Math.max(0, input.accumDep || 0), cost));
  const wdv = r2(cost - accumDep);
  const proceeds = r2(Math.max(0, input.saleProceeds || 0));
  const gainLoss = r2(proceeds - wdv);
  const lines = [];
  if (proceeds > 0) lines.push({ accountId: input.cashBankAccount, type: 'Dr', amount: proceeds });
  const accumAcc = ACCUM_DEP_ACCOUNTS[input.category];
  if (accumDep > 0 && accumAcc) lines.push({ accountId: accumAcc, type: 'Dr', amount: accumDep });
  if (gainLoss < 0) lines.push({ accountId: LOSS_ON_SALE, type: 'Dr', amount: r2(-gainLoss) });
  lines.push({ accountId: ASSET_ACCOUNTS[input.category], type: 'Cr', amount: cost });
  if (gainLoss > 0) lines.push({ accountId: PROFIT_ON_SALE, type: 'Cr', amount: gainLoss });
  const drTotal = r2(lines.filter(l => l.type === 'Dr').reduce((s, l) => s + l.amount, 0));
  return { cost, accumDep, wdv, gainLoss, drTotal, lines };
}
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

console.log(`\nAsset disposal (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
