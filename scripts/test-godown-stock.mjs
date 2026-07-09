// Godown-wise stock (ECR-17 Phase 3) — mirrors src/lib/godownStock.ts.
// Run: node scripts/test-godown-stock.mjs
const r2 = (n) => Math.round(n * 100) / 100;
const UNASSIGNED_GODOWN = 'unassigned';
function qtyDelta(type, qty) {
  if (type === 'purchase' || type === 'opening' || (type === 'adjustment' && qty > 0)) return qty;
  return -Math.abs(qty);
}
function computeGodownStock(movements, asOf) {
  const map = new Map();
  for (const m of movements) {
    if (m.isDeleted) continue;
    if (asOf && m.date && m.date > asOf) continue;
    const godownId = m.godownId || UNASSIGNED_GODOWN;
    const key = `${m.itemId}::${godownId}`;
    const row = map.get(key) ?? { itemId: m.itemId, godownId, qty: 0, inQty: 0, inValue: 0 };
    const delta = qtyDelta(m.type, m.qty || 0);
    row.qty += delta;
    if (delta > 0) { row.inQty += delta; row.inValue += delta * (m.rate || 0); }
    map.set(key, row);
  }
  const rows = [];
  for (const r of map.values()) {
    const qty = r2(Math.max(0, r.qty));
    const avg = r.inQty > 0 ? r.inValue / r.inQty : 0;
    if (qty > 0.0001) rows.push({ itemId: r.itemId, godownId: r.godownId, qty, value: r2(qty * avg) });
  }
  return rows;
}
function godownTotals(rows) { const out = {}; for (const r of rows) out[r.godownId] = r2((out[r.godownId] || 0) + r.value); return out; }

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
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
