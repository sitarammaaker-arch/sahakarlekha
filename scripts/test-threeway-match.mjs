// Procurement 3-way match (ECR-21 Phase 1) — mirrors src/lib/consumer/threeWayMatch.ts.
// Run: node scripts/test-threeway-match.mjs
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const EPS = 0.005;
const isZero = (n) => Math.abs(n) <= EPS;
const withinTol = (variance, base, tol) => {
  const v = Math.abs(variance);
  if (v <= EPS) return true;
  return v <= Math.max(Math.abs(base) * (tol.pct / 100), tol.abs);
};

function threeWayMatch(poItems, purchaseItems, tolerance = {}) {
  const tol = { pct: tolerance.pct ?? 2, abs: tolerance.abs ?? 1 };
  const billedByItem = new Map();
  for (const b of purchaseItems) billedByItem.set(b.itemId, b);
  const lines = [];

  for (const p of poItems) {
    const orderedQty = p.qty || 0;
    const receivedQty = p.receivedQty ?? p.qty ?? 0;
    const poRate = p.rate || 0;
    const bill = billedByItem.get(p.itemId);
    billedByItem.delete(p.itemId);
    const billedQty = bill?.qty || 0;
    const billedRate = bill?.rate || 0;
    const orderedAmount = round2(orderedQty * poRate);
    const receivedAmount = round2(receivedQty * poRate);
    const billedAmount = bill ? (bill.amount || round2(billedQty * billedRate)) : 0;
    const qtyVarOrderedReceived = round2(receivedQty - orderedQty);
    const qtyVarReceivedBilled = round2(billedQty - receivedQty);
    const priceVar = round2(billedRate - poRate);
    const amountVar = round2(billedAmount - receivedAmount);

    const reasons = [];
    if (qtyVarOrderedReceived < -EPS) reasons.push('short-delivery');
    if (qtyVarOrderedReceived > EPS) reasons.push('over-delivery');
    if (!bill) { if (receivedQty > EPS) reasons.push('unbilled'); }
    else {
      if (qtyVarReceivedBilled > EPS) reasons.push('over-billed-qty');
      if (qtyVarReceivedBilled < -EPS) reasons.push('under-billed-qty');
      if (!isZero(priceVar)) reasons.push('price-variance');
    }

    let status, paymentClean, paymentWithinTol;
    if (!bill) { paymentClean = receivedQty <= EPS; paymentWithinTol = paymentClean; }
    else {
      paymentClean = isZero(qtyVarReceivedBilled) && isZero(priceVar) && isZero(amountVar);
      paymentWithinTol = withinTol(qtyVarReceivedBilled, receivedQty, tol)
        && withinTol(priceVar, poRate, tol) && withinTol(amountVar, receivedAmount, tol);
    }
    const deliveryClean = isZero(qtyVarOrderedReceived);
    if (!bill && receivedQty > EPS) status = 'exception';
    else if (!paymentWithinTol) status = 'exception';
    else if (paymentClean && deliveryClean) status = 'matched';
    else status = 'within-tolerance';

    lines.push({ itemId: p.itemId, orderedQty, receivedQty, billedQty, poRate, billedRate,
      orderedAmount, receivedAmount, billedAmount, qtyVarOrderedReceived, qtyVarReceivedBilled,
      priceVar, amountVar, status, reasons });
  }
  for (const bill of billedByItem.values()) {
    const billedQty = bill.qty || 0, billedRate = bill.rate || 0;
    const billedAmount = bill.amount || round2(billedQty * billedRate);
    lines.push({ itemId: bill.itemId, orderedQty: 0, receivedQty: 0, billedQty, poRate: 0, billedRate,
      orderedAmount: 0, receivedAmount: 0, billedAmount, qtyVarOrderedReceived: 0,
      qtyVarReceivedBilled: round2(billedQty), priceVar: 0, amountVar: round2(billedAmount),
      status: 'exception', reasons: ['extra-invoice-line'] });
  }
  const matched = lines.filter(l => l.status === 'matched').length;
  const withinToleranceCount = lines.filter(l => l.status === 'within-tolerance').length;
  const exceptions = lines.filter(l => l.status === 'exception').length;
  const orderedTotal = round2(lines.reduce((s, l) => s + l.orderedAmount, 0));
  const receivedTotal = round2(lines.reduce((s, l) => s + l.receivedAmount, 0));
  const billedTotal = round2(lines.reduce((s, l) => s + l.billedAmount, 0));
  return { lines, summary: {
    status: exceptions > 0 ? 'exception' : withinToleranceCount > 0 ? 'within-tolerance' : 'matched',
    lineCount: lines.length, matched, withinTolerance: withinToleranceCount, exceptions,
    orderedTotal, receivedTotal, billedTotal, amountVarianceTotal: round2(billedTotal - receivedTotal),
  } };
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const po = (itemId, qty, rate, receivedQty) => ({ itemId, itemName: itemId, unit: 'kg', qty, rate, amount: round2(qty * rate), receivedQty });
const inv = (itemId, qty, rate) => ({ itemId, itemName: itemId, unit: 'kg', qty, rate, amount: round2(qty * rate) });

// 1. Perfect match — ordered = received = billed, same rate.
let r = threeWayMatch([po('A', 10, 100, 10)], [inv('A', 10, 100)]);
ok(r.summary.status === 'matched', 'perfect match → matched');
ok(r.summary.matched === 1 && r.summary.exceptions === 0, 'perfect match counts');
ok(r.lines[0].reasons.length === 0, 'perfect match: no reasons');
ok(r.summary.amountVarianceTotal === 0, 'perfect match: zero amount variance');

// 2. Short delivery, correctly billed for what arrived → within-tolerance (flag, not payment block).
r = threeWayMatch([po('A', 10, 100, 7)], [inv('A', 7, 100)]);
ok(r.summary.status === 'within-tolerance', 'short delivery + correct bill → within-tolerance');
ok(r.lines[0].reasons.includes('short-delivery'), 'short delivery reason flagged');
ok(r.lines[0].qtyVarOrderedReceived === -3, 'short delivery qty variance = -3');

// 3. Over-billed qty (billed > received) → exception.
r = threeWayMatch([po('A', 10, 100, 10)], [inv('A', 12, 100)]);
ok(r.summary.status === 'exception', 'over-billed qty → exception');
ok(r.lines[0].reasons.includes('over-billed-qty'), 'over-billed reason');
ok(r.lines[0].amountVar === 200, 'over-billed amount variance = +200');

// 4. Price variance beyond tolerance → exception.
r = threeWayMatch([po('A', 10, 100, 10)], [inv('A', 10, 110)]);
ok(r.summary.status === 'exception', 'price +10% → exception');
ok(r.lines[0].reasons.includes('price-variance'), 'price-variance reason');
ok(r.lines[0].priceVar === 10, 'price variance = +10');

// 5. Price variance WITHIN tolerance (1% of 100 = 1 ≤ 2% band) → within-tolerance.
r = threeWayMatch([po('A', 10, 100, 10)], [inv('A', 10, 101)]);
ok(r.summary.status === 'within-tolerance', 'price +1% (≤2%) → within-tolerance');
ok(r.lines[0].reasons.includes('price-variance'), 'small price still flagged as reason');

// 6. Received but no invoice line → unbilled exception.
r = threeWayMatch([po('A', 10, 100, 10)], []);
ok(r.summary.status === 'exception', 'received but unbilled → exception');
ok(r.lines[0].reasons.includes('unbilled'), 'unbilled reason');
ok(r.lines[0].billedAmount === 0, 'unbilled: billed amount 0');

// 7. Extra invoice line (billed an item never on the PO) → exception.
r = threeWayMatch([po('A', 10, 100, 10)], [inv('A', 10, 100), inv('B', 5, 50)]);
ok(r.summary.status === 'exception', 'extra invoice line → exception');
ok(r.lines.length === 2, 'extra line added');
const extra = r.lines.find(l => l.itemId === 'B');
ok(extra && extra.reasons.includes('extra-invoice-line'), 'extra-invoice-line reason');
ok(extra && extra.amountVar === 250, 'extra line amount variance = full bill');

// 8. Multi-line mixed: one clean, one price exception → overall exception.
r = threeWayMatch([po('A', 10, 100, 10), po('B', 4, 50, 4)], [inv('A', 10, 100), inv('B', 4, 80)]);
ok(r.summary.status === 'exception', 'mixed → worst-line (exception) wins');
ok(r.summary.matched === 1 && r.summary.exceptions === 1, 'mixed counts: 1 matched + 1 exception');

// 9. Over-delivery, correctly billed for received → within-tolerance with over-delivery flag.
r = threeWayMatch([po('A', 10, 100, 12)], [inv('A', 12, 100)]);
ok(r.summary.status === 'within-tolerance', 'over-delivery + correct bill → within-tolerance');
ok(r.lines[0].reasons.includes('over-delivery'), 'over-delivery reason');

// 10. Totals roll up across lines.
r = threeWayMatch([po('A', 10, 100, 10), po('B', 5, 20, 5)], [inv('A', 10, 100), inv('B', 5, 20)]);
ok(r.summary.orderedTotal === 1100 && r.summary.receivedTotal === 1100 && r.summary.billedTotal === 1100, 'totals roll up (1100 each)');
ok(r.summary.status === 'matched', 'clean multi-line → matched');

// ECR-21 Phase 3 — blocking-variance gate.
const hasBlockingVariance = (res) => res.summary.exceptions > 0;
const blockingReasons = (res) => { const s = new Set(); for (const l of res.lines) if (l.status === 'exception') for (const rr of l.reasons) s.add(rr); return [...s]; };

// 11. Clean / within-tolerance → NOT blocked; exception → blocked.
ok(!hasBlockingVariance(threeWayMatch([po('A', 10, 100, 10)], [inv('A', 10, 100)])), 'perfect match: not blocked');
ok(!hasBlockingVariance(threeWayMatch([po('A', 10, 100, 7)], [inv('A', 7, 100)])), 'short delivery correctly billed: not blocked');
ok(hasBlockingVariance(threeWayMatch([po('A', 10, 100, 10)], [inv('A', 10, 110)])), 'price +10%: blocked');
ok(hasBlockingVariance(threeWayMatch([po('A', 10, 100, 10)], [inv('A', 12, 100)])), 'over-billed qty: blocked');
ok(hasBlockingVariance(threeWayMatch([po('A', 10, 100, 10)], [])), 'unbilled receipt: blocked');

// 12. blockingReasons lists the distinct exception reasons.
const br = blockingReasons(threeWayMatch([po('A', 10, 100, 10)], [inv('A', 10, 110)]));
ok(br.includes('price-variance') && br.length === 1, 'blockingReasons = [price-variance]');

console.log(`\n3-way match (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
