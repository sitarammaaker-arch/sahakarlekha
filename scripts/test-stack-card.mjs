// Stack card / bin card (ECR-20) — mirrors src/lib/stackCard.ts + qtyDelta from godownStock.ts.
// Run: node scripts/test-stack-card.mjs
const UNASSIGNED_GODOWN = 'unassigned';
const qtyDelta = (type, qty) => {
  if (type === 'purchase' || type === 'opening' || (type === 'adjustment' && qty > 0)) return qty;
  return -Math.abs(qty);
};
function buildStackCard(movements, itemId, godownId) {
  const rows = (movements || [])
    .filter(m => !m.isDeleted && m.itemId === itemId && (m.godownId || UNASSIGNED_GODOWN) === godownId)
    .map((m, i) => ({ m, i }))
    .sort((a, b) => { const da = a.m.date || '', db = b.m.date || ''; if (da !== db) return da < db ? -1 : 1; return a.i - b.i; });
  let balance = 0;
  return rows.map(({ m }) => {
    const delta = qtyDelta(m.type, m.qty || 0);
    balance += delta;
    return { date: m.date, type: m.type, referenceNo: m.referenceNo, inQty: delta > 0 ? delta : 0, outQty: delta < 0 ? -delta : 0, balance: Math.round(balance * 100) / 100 };
  });
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const movs = [
  { itemId: 'A', godownId: 'G1', type: 'opening',    qty: 100, date: '2026-04-01', referenceNo: 'OB' },
  { itemId: 'A', godownId: 'G1', type: 'purchase',   qty: 50,  date: '2026-04-05', referenceNo: 'PUR/1' },
  { itemId: 'A', godownId: 'G1', type: 'sale',       qty: 30,  date: '2026-04-10', referenceNo: 'SL/1' },
  { itemId: 'A', godownId: 'G1', type: 'adjustment', qty: -5,  date: '2026-04-12', referenceNo: 'ADJ/1' },
  { itemId: 'A', godownId: 'G2', type: 'purchase',   qty: 999, date: '2026-04-06', referenceNo: 'PUR/2' }, // other godown
  { itemId: 'B', godownId: 'G1', type: 'purchase',   qty: 999, date: '2026-04-06', referenceNo: 'PUR/3' }, // other item
  { itemId: 'A', godownId: 'G1', type: 'sale',       qty: 7,   date: '2026-04-08', referenceNo: 'DEL', isDeleted: true }, // deleted
];

// 1. Filters to the chosen item+godown, excludes other item/godown/deleted.
const card = buildStackCard(movs, 'A', 'G1');
ok(card.length === 4, 'only A@G1 non-deleted movements (4)');
ok(!card.some(r => r.referenceNo === 'PUR/2' || r.referenceNo === 'PUR/3' || r.referenceNo === 'DEL'), 'excludes other godown/item/deleted');

// 2. Chronological order.
ok(card.map(r => r.referenceNo).join(',') === 'OB,PUR/1,SL/1,ADJ/1', 'chronological by date');

// 3. In/out split + running balance (100 → +50 → -30 → -5).
ok(card[0].inQty === 100 && card[0].outQty === 0 && card[0].balance === 100, 'opening: in 100, bal 100');
ok(card[1].inQty === 50 && card[1].balance === 150, 'purchase: in 50, bal 150');
ok(card[2].outQty === 30 && card[2].inQty === 0 && card[2].balance === 120, 'sale: out 30, bal 120');
ok(card[3].outQty === 5 && card[3].balance === 115, 'negative adjustment: out 5, bal 115');

// 4. Closing balance ties to on-hand (sum of deltas = 115, non-negative path).
ok(card[card.length - 1].balance === 115, 'closing balance 115 ties to on-hand');

// 5. Unassigned bucket — movements with no godownId.
const u = buildStackCard([
  { itemId: 'A', type: 'purchase', qty: 10, date: '2026-04-01' },
  { itemId: 'A', godownId: 'G1', type: 'purchase', qty: 5, date: '2026-04-02' },
], 'A', UNASSIGNED_GODOWN);
ok(u.length === 1 && u[0].balance === 10, 'untagged movement → unassigned bucket');

// 6. Over-issue surfaces a negative running balance (not floored).
const neg = buildStackCard([
  { itemId: 'A', godownId: 'G1', type: 'purchase', qty: 10, date: '2026-04-01' },
  { itemId: 'A', godownId: 'G1', type: 'sale', qty: 15, date: '2026-04-02' },
], 'A', 'G1');
ok(neg[1].balance === -5, 'over-issue → true negative balance (surfaced, not hidden)');

// 7. Empty / no-match → [].
ok(buildStackCard([], 'A', 'G1').length === 0, 'no movements → []');
ok(buildStackCard(movs, 'Z', 'G1').length === 0, 'unknown item → []');

console.log(`\nStack card (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
