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

// ── Mirror: src/lib/consumer/patronage.ts ──
const saleValue2 = (s) => (typeof s.grandTotal === 'number' && s.grandTotal > 0 ? s.grandTotal : (s.netAmount || 0));
function computePatronageLines(sales, members, args) {
  const purchase = new Map();
  for (const s of sales) {
    if (!s.memberId) continue;
    if (s.date < args.from || s.date > args.to) continue;
    purchase.set(s.memberId, (purchase.get(s.memberId) || 0) + saleValue2(s));
  }
  return members
    .filter(m => !(m.status && m.status !== 'active'))
    .map(m => { const base = round(purchase.get(m.id) || 0); return { memberId: m.id, memberName: m.name, base, amount: round(base * (args.ratePct || 0) / 100) }; })
    .filter(l => l.amount > 0)
    .sort((a, b) => a.memberName.localeCompare(b.memberName));
}
const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const PSALES = [
  { memberId: 'M1', grandTotal: 1000, netAmount: 1000, date: '2025-06-10' },
  { memberId: 'M1', grandTotal: 500,  netAmount: 500,  date: '2026-01-05' }, // same member, in window
  { memberId: 'M2', grandTotal: 2000, netAmount: 2000, date: '2025-09-01' },
  { memberId: 'M3', grandTotal: 800,  netAmount: 800,  date: '2025-09-01' }, // inactive member — excluded
  { memberId: 'M1', grandTotal: 400,  netAmount: 400,  date: '2024-12-31' }, // before window — excluded
  {                  grandTotal: 999,  netAmount: 999,  date: '2025-09-01' }, // walk-in (no member) — excluded
];
const PMEMBERS = [
  { id: 'M1', name: 'Asha', status: 'active' },
  { id: 'M2', name: 'Bhola', status: 'active' },
  { id: 'M3', name: 'Chand', status: 'inactive' },
];

// 15. rebate = ratePct% of each active member's in-window purchases; inactive + walk-in + out-of-window excluded
{
  const lines = computePatronageLines(PSALES, PMEMBERS, { from: '2025-04-01', to: '2026-03-31', ratePct: 2 });
  ok(lines.length === 2, 'only 2 active members with in-window purchases (M3 inactive excluded)');
  const asha = lines.find(l => l.memberId === 'M1');
  ok(asha && asha.base === 1500 && asha.amount === 30, 'Asha base 1000+500=1500, rebate 2% = 30 (Dec-2024 sale excluded)');
  const bhola = lines.find(l => l.memberId === 'M2');
  ok(bhola && bhola.base === 2000 && bhola.amount === 40, 'Bhola base 2000, rebate 40');
}

// 16. zero rate → no lines
ok(computePatronageLines(PSALES, PMEMBERS, { from: '2025-04-01', to: '2026-03-31', ratePct: 0 }).length === 0, 'rate 0 → no rebate lines');

// ── Mirror: src/lib/consumer/registers.ts ──
function buildCounterSummary(sales, from, to) {
  const tenders = { cash: { amount: 0, count: 0 }, bank: { amount: 0, count: 0 }, credit: { amount: 0, count: 0 } };
  let count = 0, total = 0;
  for (const s of sales) {
    if (s.date < from || s.date > to) continue;
    const v = saleTotal(s);
    const t = (s.paymentMode === 'cash' || s.paymentMode === 'bank' || s.paymentMode === 'credit') ? s.paymentMode : 'cash';
    tenders[t].amount = Math.round((tenders[t].amount + v) * 100) / 100; tenders[t].count += 1;
    total = Math.round((total + v) * 100) / 100; count += 1;
  }
  return { count, total, tenders };
}
function buildOutstandingRegister(members, sales, recoveries, asOf) {
  const rows = [];
  for (const m of members) {
    const outstanding = memberOutstanding(sales, recoveries, m.id);
    if (outstanding <= 0) continue;
    rows.push({ memberId: m.id, memberName: m.name, outstanding, ageing: memberAgeing(sales, recoveries, m.id, asOf) });
  }
  rows.sort((a, b) => b.outstanding - a.outstanding);
  return { rows, totalOutstanding: Math.round(rows.reduce((s, r) => s + r.outstanding, 0) * 100) / 100 };
}

const CSALES = [
  { paymentMode: 'cash',   grandTotal: 100, netAmount: 100, date: '2026-07-04' },
  { paymentMode: 'bank',   grandTotal: 250, netAmount: 250, date: '2026-07-04' },
  { paymentMode: 'credit', grandTotal: 300, netAmount: 300, date: '2026-07-04', memberId: 'M1' },
  { paymentMode: 'cash',   grandTotal: 999, netAmount: 999, date: '2026-07-01' }, // outside the day
];

// 17. counter Z-report splits by tender within the window
{
  const sum = buildCounterSummary(CSALES, '2026-07-04', '2026-07-04');
  ok(sum.count === 3 && sum.total === 650, 'day total 3 bills / 650 (2026-07-01 excluded)');
  ok(sum.tenders.cash.amount === 100 && sum.tenders.bank.amount === 250 && sum.tenders.credit.amount === 300, 'per-tender split correct');
}

// 18. outstanding register lists only members with dues, sorted desc
{
  const reg = buildOutstandingRegister(
    [{ id: 'M1', name: 'Asha', status: 'active' }, { id: 'M2', name: 'Bhola', status: 'active' }],
    [{ id: 'x', memberId: 'M1', paymentMode: 'credit', grandTotal: 300, netAmount: 300, date: '2026-07-04' }],
    [],
    '2026-07-04',
  );
  ok(reg.rows.length === 1 && reg.rows[0].memberId === 'M1' && reg.totalOutstanding === 300, 'only M1 has outstanding 300');
}

console.log(`\nConsumer pricing + credit + patronage + registers: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
