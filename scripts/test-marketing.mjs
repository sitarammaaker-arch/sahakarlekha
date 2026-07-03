// Unit tests for Marketing M1c — the effective-dated MSP rate resolver
// (src/lib/marketing/msp.ts). Faithful JS mirror of the pure TS logic; tsc guarantees the TS
// compiles, this pins the behaviour.
// Run: node scripts/test-marketing.mjs   (exit 1 on any failure)

// ── Mirror: src/lib/marketing/msp.ts ──
function pickEffectiveMspRate(rates, args) {
  if (!args.cropId || !args.seasonId) return null;
  const eligible = rates
    .filter(r => r.cropId === args.cropId && r.seasonId === args.seasonId && (!r.effectiveFrom || r.effectiveFrom <= args.date))
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : a.effectiveFrom > b.effectiveFrom ? -1 : 0));
  const top = eligible[0];
  return top && typeof top.rate?.amount === 'number' && isFinite(top.rate.amount) ? top.rate.amount : null;
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const money = (n) => ({ amount: n, currency: 'INR' });
const RATES = [
  { id: 'a', cropId: 'wheat', seasonId: 'rabi2526', rate: money(2275), effectiveFrom: '2025-10-01' },
  { id: 'b', cropId: 'wheat', seasonId: 'rabi2526', rate: money(2425), effectiveFrom: '2026-01-01' }, // revised
  { id: 'c', cropId: 'paddy', seasonId: 'kharif25', rate: money(2300), effectiveFrom: '2025-06-01' },
];

// 1. latest effectiveFrom on/before the date wins (revision supersedes)
{
  ok(pickEffectiveMspRate(RATES, { cropId: 'wheat', seasonId: 'rabi2526', date: '2026-02-15' }) === 2425, 'revised wheat rate (Jan) applies in Feb');
  ok(pickEffectiveMspRate(RATES, { cropId: 'wheat', seasonId: 'rabi2526', date: '2025-11-15' }) === 2275, 'original wheat rate applies before the revision');
}

// 2. crop + season must both match
{
  ok(pickEffectiveMspRate(RATES, { cropId: 'paddy', seasonId: 'kharif25', date: '2025-07-01' }) === 2300, 'paddy/kharif resolves its own rate');
  ok(pickEffectiveMspRate(RATES, { cropId: 'paddy', seasonId: 'rabi2526', date: '2026-02-15' }) === null, 'paddy has no rabi rate → null');
  ok(pickEffectiveMspRate(RATES, { cropId: 'gram', seasonId: 'rabi2526', date: '2026-02-15' }) === null, 'unknown crop → null');
}

// 3. date before the earliest effectiveFrom → null (no rate in force yet)
{
  ok(pickEffectiveMspRate(RATES, { cropId: 'wheat', seasonId: 'rabi2526', date: '2025-09-01' }) === null, 'before any wheat rate is effective → null');
}

// 4. missing crop or season → null (cannot auto-fill)
{
  ok(pickEffectiveMspRate(RATES, { cropId: '', seasonId: 'rabi2526', date: '2026-02-15' }) === null, 'no crop → null');
  ok(pickEffectiveMspRate(RATES, { cropId: 'wheat', seasonId: '', date: '2026-02-15' }) === null, 'no season → null');
}

// 5. empty / malformed inputs → null
{
  ok(pickEffectiveMspRate([], { cropId: 'wheat', seasonId: 'rabi2526', date: '2026-02-15' }) === null, 'no rates → null');
  ok(pickEffectiveMspRate([{ id: 'x', cropId: 'wheat', seasonId: 'rabi2526', rate: money(NaN), effectiveFrom: '2025-10-01' }], { cropId: 'wheat', seasonId: 'rabi2526', date: '2026-02-15' }) === null, 'NaN rate → null');
}

// ── Mirror: src/lib/marketing/registers.ts ──
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const lotValue = (l) => r2((l.quantity?.value || 0) * (l.mspRate?.amount || 0));
function buildProcurementRegister(lots, from, to) {
  const rows = lots
    .map(l => ({ l, date: (l.createdAt || '').slice(0, 10) }))
    .filter(({ date }) => (!from || date >= from) && (!to || date <= to))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map(({ l, date }) => ({ lotId: l.id, date, farmerId: l.farmerId, cropId: l.cropId, qty: l.quantity?.value || 0, rate: l.mspRate?.amount || 0, value: lotValue(l), status: l.operationalStatus }));
  return { rows, totalQty: r2(rows.reduce((s, x) => s + x.qty, 0)), totalValue: r2(rows.reduce((s, x) => s + x.value, 0)), count: rows.length };
}
function buildCommoditySummary(lots) {
  const map = new Map();
  for (const l of lots) {
    const cur = map.get(l.cropId) || { cropId: l.cropId, qty: 0, value: 0, lots: 0 };
    cur.qty = r2(cur.qty + (l.quantity?.value || 0)); cur.value = r2(cur.value + lotValue(l)); cur.lots += 1;
    map.set(l.cropId, cur);
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}
function settlementTotals(settlements) {
  const live = settlements.filter(s => !s.isDeleted);
  const gross = r2(live.reduce((s, x) => s + (x.gross?.amount || 0), 0));
  const deductions = r2(live.reduce((s, x) => s + (x.deductionLines || []).reduce((a, l) => a + (l.amount?.amount || 0), 0), 0));
  const net = r2(live.reduce((s, x) => s + (x.netPayable?.amount || 0), 0));
  const paid = r2(live.reduce((s, x) => s + (x.amountPaid?.amount || 0), 0));
  return { gross, deductions, net, paid, outstanding: r2(net - paid), count: live.length };
}

const qtl = (v) => ({ value: v, unit: 'qtl' });
const rate = (n) => ({ amount: n, currency: 'INR' });
const LOTS = [
  { id: 'L1', farmerId: 'F1', cropId: 'wheat', quantity: qtl(20), mspRate: rate(2425), operationalStatus: 'created', createdAt: '2026-02-01T09:00:00Z' },
  { id: 'L2', farmerId: 'F2', cropId: 'wheat', quantity: qtl(30), mspRate: rate(2425), operationalStatus: 'created', createdAt: '2026-02-10T09:00:00Z' },
  { id: 'L3', farmerId: 'F1', cropId: 'mustard', quantity: qtl(10), mspRate: rate(5650), operationalStatus: 'created', createdAt: '2026-02-15T09:00:00Z' },
];

// 6. Procurement register: per-lot value, window filter, totals, newest first
{
  const reg = buildProcurementRegister(LOTS);
  ok(reg.count === 3 && reg.totalQty === 60, 'proc register: 3 lots, total 60 qtl');
  ok(reg.totalValue === r2(20 * 2425 + 30 * 2425 + 10 * 5650), 'proc register: total value = Σ qty×rate');
  ok(reg.rows[0].lotId === 'L3' && reg.rows[2].lotId === 'L1', 'proc register: newest lot first');
  ok(reg.rows[0].value === 56500, 'proc register: mustard lot value 10×5650 = 56500');
  const win = buildProcurementRegister(LOTS, '2026-02-05', '2026-02-12');
  ok(win.count === 1 && win.rows[0].lotId === 'L2', 'proc register: date window keeps only L2 (Feb 10)');
}

// 7. Commodity summary: per-crop qty/value/lots, highest value first
{
  const cs = buildCommoditySummary(LOTS);
  ok(cs.length === 2, 'commodity summary: 2 crops');
  ok(cs[0].cropId === 'wheat' && cs[0].qty === 50 && cs[0].lots === 2, 'commodity: wheat 50 qtl across 2 lots');
  ok(cs[0].value === r2(50 * 2425) && cs[0].value > cs[1].value, 'commodity: wheat value highest, sorted desc');
}

// 8. Settlement totals: gross/deductions/net/paid/outstanding; soft-deleted excluded
{
  const S = [
    { gross: rate(48500), deductionLines: [{ amount: rate(970) }], netPayable: rate(47530), amountPaid: rate(47530) },
    { gross: rate(72750), deductionLines: [{ amount: rate(1455) }, { amount: rate(500) }], netPayable: rate(70795), amountPaid: rate(30000) },
    { gross: rate(1000), deductionLines: [], netPayable: rate(1000), amountPaid: rate(0), isDeleted: true },
  ];
  const t = settlementTotals(S);
  ok(t.count === 2, 'settlement totals: soft-deleted excluded (2 of 3)');
  ok(t.gross === 121250 && t.deductions === 2925, 'settlement totals: gross 121250, deductions 2925');
  ok(t.net === 118325 && t.paid === 77530 && t.outstanding === r2(118325 - 77530), 'settlement totals: net/paid/outstanding tie out');
}

console.log(`[marketing-test] ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
