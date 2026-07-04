// Unit tests for Consumer C2 — the effective-dated tier price resolver
// (src/lib/consumer/pricing.ts). Faithful JS mirror of the pure TS logic; tsc guarantees the
// TS compiles, this pins the behaviour.
// Run: node scripts/test-consumer.mjs   (exit 1 on any failure)

// ── Mirror: src/lib/consumer/pricing.ts ──
function resolveItemPrice(item, tier, prices, date) {
  const base = item.saleRate || 0;
  if (!tier || tier === 'retail') return base;
  const eligible = prices
    .filter(p => !p.isDeleted && p.itemId === item.id && p.tier === tier && (!p.effectiveFrom || p.effectiveFrom <= date))
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : a.effectiveFrom > b.effectiveFrom ? -1 : 0));
  const top = eligible[0];
  return top && typeof top.price === 'number' && isFinite(top.price) ? top.price : base;
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const ITEM = { id: 'wheat', saleRate: 40 };
const PRICES = [
  { id: 'p1', itemId: 'wheat', tier: 'member', price: 36, effectiveFrom: '2025-04-01' },
  { id: 'p2', itemId: 'wheat', tier: 'member', price: 34, effectiveFrom: '2026-01-01' }, // revised cheaper
  { id: 'p3', itemId: 'wheat', tier: 'wholesale', price: 32, effectiveFrom: '2025-04-01' },
  { id: 'p4', itemId: 'rice', tier: 'member', price: 50, effectiveFrom: '2025-04-01' },
];

// 1. retail / empty tier → base saleRate (no override consulted)
ok(resolveItemPrice(ITEM, 'retail', PRICES, '2026-02-01') === 40, 'retail → base saleRate');
ok(resolveItemPrice(ITEM, '', PRICES, '2026-02-01') === 40, 'empty tier → base saleRate');

// 2. latest effectiveFrom on/before the date wins (revision supersedes)
ok(resolveItemPrice(ITEM, 'member', PRICES, '2026-02-01') === 34, 'revised member price (Jan) applies in Feb');
ok(resolveItemPrice(ITEM, 'member', PRICES, '2025-06-01') === 36, 'original member price applies before the revision');

// 3. tier isolation — wholesale is its own price, not the member one
ok(resolveItemPrice(ITEM, 'wholesale', PRICES, '2026-02-01') === 32, 'wholesale resolves its own tier');

// 4. no tier row in force yet (date before earliest effectiveFrom) → base saleRate (member never pays more than retail)
ok(resolveItemPrice(ITEM, 'member', PRICES, '2025-01-01') === 40, 'before any member price → falls back to retail');

// 5. item without any tier override → base saleRate
ok(resolveItemPrice({ id: 'sugar', saleRate: 45 }, 'member', PRICES, '2026-02-01') === 45, 'unpriced item → retail fallback');

// 6. soft-deleted override is ignored
{
  const withDeleted = [{ id: 'p9', itemId: 'wheat', tier: 'member', price: 30, effectiveFrom: '2026-01-01', isDeleted: true }, ...PRICES];
  ok(resolveItemPrice(ITEM, 'member', withDeleted, '2026-02-01') === 34, 'deleted override ignored, next-latest wins');
}

// 7. another item resolves independently
ok(resolveItemPrice({ id: 'rice', saleRate: 55 }, 'member', PRICES, '2026-02-01') === 50, 'rice member price is its own');

// ── Mirror: src/lib/consumer/credit.ts ──
const saleTotal = (s) => (typeof s.grandTotal === 'number' && s.grandTotal > 0 ? s.grandTotal : (s.netAmount || 0));
function memberCreditSales(sales, memberId) {
  return sales.filter(s => s.memberId === memberId && s.paymentMode === 'credit').slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
function memberRecovered(recoveries, memberId) {
  return recoveries.filter(r => r.memberId === memberId && !r.isDeleted).reduce((s, r) => s + (r.amount || 0), 0);
}
function memberOutstanding(sales, recoveries, memberId) {
  const billed = memberCreditSales(sales, memberId).reduce((s, x) => s + saleTotal(x), 0);
  return Math.max(0, billed - memberRecovered(recoveries, memberId));
}
function daysBetween(fromDate, asOf) {
  const a = Date.parse(fromDate), b = Date.parse(asOf);
  if (!isFinite(a) || !isFinite(b)) return 0;
  return Math.max(0, Math.floor((b - a) / 86400000));
}
function memberAgeing(sales, recoveries, memberId, asOf) {
  const out = { b0_30: 0, b31_60: 0, b61_90: 0, b90plus: 0, total: 0 };
  let recovered = memberRecovered(recoveries, memberId);
  for (const s of memberCreditSales(sales, memberId)) {
    let unpaid = saleTotal(s);
    if (recovered > 0) { const applied = Math.min(recovered, unpaid); unpaid -= applied; recovered -= applied; }
    if (unpaid <= 0) continue;
    const age = daysBetween(s.date, asOf);
    if (age <= 30) out.b0_30 += unpaid;
    else if (age <= 60) out.b31_60 += unpaid;
    else if (age <= 90) out.b61_90 += unpaid;
    else out.b90plus += unpaid;
    out.total += unpaid;
  }
  return out;
}

const SALES = [
  { id: 's1', memberId: 'M1', paymentMode: 'credit', grandTotal: 500, netAmount: 500, date: '2026-05-01' },
  { id: 's2', memberId: 'M1', paymentMode: 'credit', grandTotal: 300, netAmount: 300, date: '2026-06-20' },
  { id: 's3', memberId: 'M1', paymentMode: 'cash',   grandTotal: 999, netAmount: 999, date: '2026-06-25' }, // cash — not credit
  { id: 's4', memberId: 'M2', paymentMode: 'credit', grandTotal: 200, netAmount: 200, date: '2026-06-01' },
];
const RECOVERIES = [
  { memberId: 'M1', amount: 200 },
  { memberId: 'M1', amount: 100, isDeleted: true }, // reversed — ignored
];

// 8. outstanding = Σ credit sales − Σ live recoveries (cash sale + deleted recovery excluded)
ok(memberOutstanding(SALES, RECOVERIES, 'M1') === 600, 'M1 outstanding = 500+300 − 200 = 600');
ok(memberOutstanding(SALES, RECOVERIES, 'M2') === 200, 'M2 outstanding = 200 (no recovery)');

// 9. FIFO ageing on 2026-06-30: recovery 200 clears the May-01 sale (age 60), leaving 300 unpaid at age 10
{
  const ag = memberAgeing(SALES, RECOVERIES, 'M1', '2026-06-30');
  ok(ag.total === 600, 'M1 ageing total 600');
  ok(ag.b0_30 === 300, 'Jun-20 sale (300) sits in 0–30 bucket');
  ok(ag.b31_60 === 300, 'May-01 sale remainder (500−200=300) sits in 31–60 bucket');
}

console.log(`\nConsumer pricing + credit: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
