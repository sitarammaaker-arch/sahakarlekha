// Unit tests for RULE-2/3 stock reconciliation (src/lib/stockUtils.ts reconcileMovements + computeStock).
// Faithful JS mirror of the pure TS logic; tsc guarantees the TS compiles, this pins the behaviour.
// Run: node scripts/test-stock-reconcile.mjs   (exit 1 on any failure)

// ── Mirror: src/lib/stockUtils.ts ──
function computeStock(item, movements) {
  let qty = item.openingStock || 0;
  for (const m of movements) {
    if (m.itemId !== item.id) continue;
    if (m.type === 'purchase' || (m.type === 'adjustment' && m.qty > 0)) qty += m.qty;
    else qty -= Math.abs(m.qty);
  }
  return Math.max(0, qty);
}

function reconcileMovements(movements, sales, purchases) {
  const kept = movements.filter(m => m.type !== 'purchase' && m.type !== 'sale');
  const synth = [];
  for (const p of purchases) {
    if (p.isDeleted) continue;
    for (const it of p.items) synth.push({ itemId: it.itemId, type: 'purchase', qty: it.qty, rate: it.rate, amount: it.amount, referenceNo: p.purchaseNo, date: p.date });
  }
  for (const s of sales) {
    if (s.isDeleted) continue;
    for (const it of s.items) synth.push({ itemId: it.itemId, type: 'sale', qty: it.qty, rate: it.rate, amount: it.amount, referenceNo: s.saleNo, date: s.date });
  }
  return [...synth, ...kept];
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const OIL = { id: 'oil', openingStock: 0 };
const stockOf = (movs, sales, purchases) => computeStock(OIL, reconcileMovements(movs, sales, purchases));

// ── 1) The real Rania defect: live PUR/006=5, SL/004=3, +1 sales return, −1 purchase return
//    but stock_movements carry an ORPHAN sale (SL/001 −5) and the purchase movement under a
//    stale number (PUR/001), while live PUR/006 has NO movement. Raw sum clamps to 0; the
//    reconciled sum must equal the live-record truth: 5 − 3 + 1 − 1 = 2. ──
{
  const purchases = [{ purchaseNo: 'PUR/006', date: '2026-09-18', isDeleted: false, items: [{ itemId: 'oil', qty: 5, rate: 2664, amount: 13320 }] }];
  const sales = [{ saleNo: 'SL/004', date: '2026-09-18', isDeleted: false, items: [{ itemId: 'oil', qty: 3, rate: 2700, amount: 8100 }] }];
  const movements = [
    { itemId: 'oil', type: 'purchase', qty: 5, rate: 2664, amount: 13320, referenceNo: 'PUR/001' },   // stale-numbered
    { itemId: 'oil', type: 'sale', qty: 5, rate: 2700, amount: 13500, referenceNo: 'SL/001' },          // ORPHAN (deleted sale)
    { itemId: 'oil', type: 'sale', qty: 3, rate: 2700, amount: 8100, referenceNo: 'SL/004' },
    { itemId: 'oil', type: 'adjustment', qty: 1, rate: 2700, amount: 2700, referenceNo: 'SRET/001' },   // sales return (kept)
    { itemId: 'oil', type: 'adjustment', qty: -1, rate: 2664, amount: -2664, referenceNo: 'PRET/001' }, // purchase return (kept)
  ];
  ok(computeStock(OIL, movements) === 0, `raw (drifted) movements clamp to 0 (got ${computeStock(OIL, movements)})`);
  ok(stockOf(movements, sales, purchases) === 2, `reconciled stock equals live truth = 2 (got ${stockOf(movements, sales, purchases)})`);
}

// ── 2) No-op guarantee: for correctly-synced data, reconcile gives the SAME quantity as raw. ──
{
  const purchases = [{ purchaseNo: 'PUR/001', date: '2026-04-01', isDeleted: false, items: [{ itemId: 'oil', qty: 10, rate: 100, amount: 1000 }] }];
  const sales = [{ saleNo: 'SL/001', date: '2026-04-02', isDeleted: false, items: [{ itemId: 'oil', qty: 4, rate: 120, amount: 480 }] }];
  const movements = [
    { itemId: 'oil', type: 'purchase', qty: 10, rate: 100, amount: 1000, referenceNo: 'PUR/001' },
    { itemId: 'oil', type: 'sale', qty: 4, rate: 120, amount: 480, referenceNo: 'SL/001' },
  ];
  ok(computeStock(OIL, movements) === 6 && stockOf(movements, sales, purchases) === 6, 'healthy data: reconcile is a no-op (both 6)');
}

// ── 3) A deleted sale's outward movement is dropped (isDeleted respected). ──
{
  const purchases = [{ purchaseNo: 'PUR/001', date: '2026-04-01', isDeleted: false, items: [{ itemId: 'oil', qty: 10, rate: 100, amount: 1000 }] }];
  const sales = [{ saleNo: 'SL/001', date: '2026-04-02', isDeleted: true, items: [{ itemId: 'oil', qty: 4, rate: 120, amount: 480 }] }]; // deleted
  const movements = [
    { itemId: 'oil', type: 'purchase', qty: 10, rate: 100, amount: 1000, referenceNo: 'PUR/001' },
    { itemId: 'oil', type: 'sale', qty: 4, rate: 120, amount: 480, referenceNo: 'SL/001' },  // orphan of a deleted sale
  ];
  ok(stockOf(movements, sales, purchases) === 10, `deleted sale's outward dropped → 10 (got ${stockOf(movements, sales, purchases)})`);
}

// ── 4) A live doc whose movement is MISSING is still counted (derived from the record). ──
{
  const purchases = [{ purchaseNo: 'PUR/006', date: '2026-09-01', isDeleted: false, items: [{ itemId: 'oil', qty: 7, rate: 100, amount: 700 }] }];
  const sales = [];
  const movements = []; // the purchase movement never got created (the drift bug)
  ok(stockOf(movements, sales, purchases) === 7, `live purchase with no movement still counts → 7 (got ${stockOf(movements, sales, purchases)})`);
}

// ── 5) Returns/adjustments (no parent doc) are preserved. ──
{
  const purchases = [];
  const sales = [];
  const movements = [
    { itemId: 'oil', type: 'adjustment', qty: 5, referenceNo: 'ADJ' },   // +5 manual adjustment
    { itemId: 'oil', type: 'adjustment', qty: -2, referenceNo: 'WOFF:damage' }, // −2 write-off
  ];
  ok(stockOf(movements, sales, purchases) === 3, `adjustments preserved → 3 (got ${stockOf(movements, sales, purchases)})`);
}

console.log(`\nstock-reconcile: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
