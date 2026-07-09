// Depreciation rate master (ECR-15) — mirrors src/lib/depreciationRateMaster.ts.
// Run: node scripts/test-depreciation-rate-master.mjs
const DEPRECIATION_RATE_MASTER = { Land: 0, Building: 10, Furniture: 10, Equipment: 15, Vehicle: 15, Computer: 40, Other: 15 };
const standardDepreciationRate = (category) => DEPRECIATION_RATE_MASTER[category] ?? 0;
function assetRateDeviations(assets) {
  const out = [];
  for (const a of assets || []) {
    if (a.isDeleted || a.disposalDate || a.category === 'Land') continue;
    const standard = standardDepreciationRate(a.category);
    const rate = a.depreciationRate || 0;
    if (Math.abs(rate - standard) > 0.005) out.push({ id: a.id, name: a.name, category: a.category, rate, standard });
  }
  return out;
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Standard rates.
ok(standardDepreciationRate('Building') === 10, 'Building = 10%');
ok(standardDepreciationRate('Computer') === 40, 'Computer = 40%');
ok(standardDepreciationRate('Land') === 0, 'Land = 0% (never depreciated)');
ok(standardDepreciationRate('Whatever') === 0, 'unknown category → 0');

// 2. Deviations — flags only mismatches on live, non-Land assets.
{
  const assets = [
    { id: 'a', name: 'HQ Building', category: 'Building', depreciationRate: 10 },   // matches → not flagged
    { id: 'b', name: 'Old Laptop', category: 'Computer', depreciationRate: 15 },    // 15 ≠ 40 → flagged
    { id: 'c', name: 'Plot', category: 'Land', depreciationRate: 5 },               // Land → excluded
    { id: 'd', name: 'Sold Van', category: 'Vehicle', depreciationRate: 99, disposalDate: '2026-04-01' }, // disposed → excluded
    { id: 'e', name: 'Archived', category: 'Furniture', depreciationRate: 99, isDeleted: true },          // archived → excluded
    { id: 'f', name: 'Chair', category: 'Furniture', depreciationRate: 12 },        // 12 ≠ 10 → flagged
  ];
  const dev = assetRateDeviations(assets);
  ok(dev.length === 2, 'exactly 2 deviations (Laptop, Chair)');
  ok(dev.some(d => d.id === 'b' && d.rate === 15 && d.standard === 40), 'laptop: 15 vs standard 40');
  ok(dev.some(d => d.id === 'f' && d.rate === 12 && d.standard === 10), 'chair: 12 vs standard 10');
  ok(!dev.some(d => ['a', 'c', 'd', 'e'].includes(d.id)), 'matching / Land / disposed / archived not flagged');
}

// 3. Missing rate (0) on a depreciable category → deviation.
{
  const dev = assetRateDeviations([{ id: 'x', name: 'No-rate Vehicle', category: 'Vehicle', depreciationRate: 0 }]);
  ok(dev.length === 1 && dev[0].standard === 15, 'rate 0 on Vehicle → flagged (expected 15)');
}

// 4. Sub-rupee/percent tolerance.
{
  const dev = assetRateDeviations([{ id: 'y', name: 'Bldg', category: 'Building', depreciationRate: 10.001 }]);
  ok(dev.length === 0, '10.001 ≈ 10 → within tolerance, not flagged');
}

console.log(`\nDepreciation rate master (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
