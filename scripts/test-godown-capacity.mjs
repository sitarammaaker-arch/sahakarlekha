// Godown capacity utilisation (ECR-20) — mirrors src/lib/godownCapacity.ts.
// Run: node scripts/test-godown-capacity.mjs
const r1 = (n) => Math.round(n * 10) / 10;
function capacityUtilisation(usedQty, capacityMT) {
  const cap = capacityMT != null && capacityMT > 0 ? capacityMT : null;
  const used = usedQty || 0;
  return { capacityMT: cap, usedQty: used, utilisationPct: cap ? r1((used / cap) * 100) : null, overCapacity: cap != null && used > cap };
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Normal utilisation.
{ const r = capacityUtilisation(50, 100); ok(r.utilisationPct === 50 && !r.overCapacity && r.capacityMT === 100, '50/100 → 50%, not over'); }
// 2. Exactly full → 100%, not over (over is strictly greater).
{ const r = capacityUtilisation(100, 100); ok(r.utilisationPct === 100 && !r.overCapacity, 'full → 100%, not over'); }
// 3. Over capacity.
{ const r = capacityUtilisation(120, 100); ok(r.utilisationPct === 120 && r.overCapacity, 'over → 120%, over flag'); }
// 4. No capacity set → pct null, never over.
{ const r = capacityUtilisation(80, undefined); ok(r.utilisationPct === null && !r.overCapacity && r.capacityMT === null, 'undefined capacity → null pct, not over'); }
{ const r = capacityUtilisation(80, 0); ok(r.utilisationPct === null && !r.overCapacity, 'zero capacity → null pct, not over'); }
{ const r = capacityUtilisation(80, null); ok(r.utilisationPct === null, 'null capacity → null pct'); }
// 5. Empty godown.
{ const r = capacityUtilisation(0, 100); ok(r.utilisationPct === 0 && !r.overCapacity, 'empty → 0%'); }
// 6. Rounding to 1 decimal.
{ const r = capacityUtilisation(1, 3); ok(r.utilisationPct === 33.3, '1/3 → 33.3%'); }
// 7. usedQty falsy guard.
{ const r = capacityUtilisation(undefined, 100); ok(r.usedQty === 0 && r.utilisationPct === 0, 'undefined used → 0'); }

console.log(`\nGodown capacity (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
