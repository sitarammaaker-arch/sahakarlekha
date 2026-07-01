// Unit tests for Dairy D1 — the Fat+SNF pricing engine (src/lib/dairy/pricing.ts) and the
// dedicated-milk-account resolvers (src/lib/dairy/accounts.ts). Faithful JS mirrors of the pure
// TS logic; tsc guarantees the TS compiles, this pins the behaviour.
// Run: node scripts/test-dairy.mjs   (exit 1 on any failure)

// ── Mirror: src/lib/dairy/pricing.ts ──
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
function bandIndex(bands, v) {
  if (!bands || bands.length === 0) return -1;
  for (let i = 0; i < bands.length; i++) if (v >= bands[i].min && v < bands[i].max) return i;
  if (v < bands[0].min) return 0;
  return bands.length - 1;
}
function pickEffectiveChart(charts, date, season) {
  const eligible = charts
    .filter(c => !c.isDeleted && c.effectiveFrom <= date && (!season || !c.season || c.season === season))
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : a.effectiveFrom > b.effectiveFrom ? -1 : 0));
  return eligible[0] ?? null;
}
function resolveRate(chart, fat, snf) {
  if (!chart) return null;
  const fi = bandIndex(chart.fatBands, fat);
  const si = bandIndex(chart.snfBands, snf);
  if (fi < 0 || si < 0) return null;
  const row = chart.matrix[fi];
  if (!row) return null;
  const rate = row[si];
  return typeof rate === 'number' && isFinite(rate) ? rate : null;
}
function priceMilk(charts, args) {
  const chart = pickEffectiveChart(charts, args.date, args.season);
  const rate = resolveRate(chart, args.fat, args.snf);
  return { rate, amount: rate == null ? 0 : round2(args.qty * rate) };
}

// ── Mirror: src/lib/dairy/accounts.ts ──
const DAIRY_ACCOUNT_IDS = { milkProcurement: '5108', milkBulkSales: '4106', milkPayable: '2102' };
function findBy(accounts, subtype, id, hints) {
  const live = accounts.filter(a => !a.isDeleted);
  if (subtype) { const s = live.find(a => a.subtype === subtype); if (s) return s.id; }
  const byId = live.find(a => a.id === id); if (byId) return byId.id;
  const byName = live.find(a => hints.some(h => (a.nameHi || '').includes(h) || (a.name || '').toLowerCase().includes(h.toLowerCase())));
  return byName ? byName.id : null;
}
const resolveMilkProcurementAccountId = (a) => findBy(a, 'milk_procurement', DAIRY_ACCOUNT_IDS.milkProcurement, ['दुग्ध खरीदी', 'दूध खरीद', 'Milk Procurement']);
const resolveMilkBulkSalesAccountId = (a) => findBy(a, 'milk_sales', DAIRY_ACCOUNT_IDS.milkBulkSales, ['दुग्ध बिक्री', 'Milk Sales']);
const resolveMilkPayableAccountId = (a) => findBy(a, null, DAIRY_ACCOUNT_IDS.milkPayable, ['देय दुग्ध', 'दुग्ध भुगतान', 'Milk Payment Payable', 'Milk Payable']);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const FAT = [{ min: 3.0, max: 3.5 }, { min: 3.5, max: 4.0 }, { min: 4.0, max: 4.5 }];
const SNF = [{ min: 8.0, max: 8.5 }, { min: 8.5, max: 9.0 }];
const CHART = { id: 'c1', name: 'Jul', basis: 'fat_snf', effectiveFrom: '2026-07-01', fatBands: FAT, snfBands: SNF, matrix: [[30, 32], [34, 36], [38, 40]] };

// 1. bandIndex: exact hit, half-open boundary, clamp low/high, empty
{
  ok(bandIndex(FAT, 3.2) === 0, 'fat 3.2 → band 0');
  ok(bandIndex(FAT, 3.5) === 1, 'boundary 3.5 belongs to the upper band (half-open [min,max))');
  ok(bandIndex(FAT, 2.0) === 0, 'below range clamps to first band');
  ok(bandIndex(FAT, 9.9) === 2, 'above range clamps to last band');
  ok(bandIndex([], 4) === -1, 'no bands → -1');
}

// 2. resolveRate: matrix cell lookup by fat×snf
{
  ok(resolveRate(CHART, 3.2, 8.2) === 30, 'fat 3.2 / snf 8.2 → matrix[0][0] = 30');
  ok(resolveRate(CHART, 3.7, 8.7) === 36, 'fat 3.7 / snf 8.7 → matrix[1][1] = 36');
  ok(resolveRate(CHART, 4.2, 8.1) === 38, 'fat 4.2 / snf 8.1 → matrix[2][0] = 38');
}

// 3. resolveRate: out-of-range clamps to the edge cell (edge values still price)
{
  ok(resolveRate(CHART, 2.0, 7.0) === 30, 'very low fat & snf clamp to the corner rate 30');
  ok(resolveRate(CHART, 9.0, 9.9) === 40, 'very high fat & snf clamp to the opposite corner 40');
}

// 4. resolveRate: null when no chart or missing cell
{
  ok(resolveRate(null, 4, 8.5) === null, 'no chart → null rate');
  ok(resolveRate({ ...CHART, matrix: [[30, 32]] }, 4.2, 8.1) === null, 'fat band with no matrix row → null');
  ok(resolveRate({ ...CHART, fatBands: [] }, 4, 8.5) === null, 'chart with no fat bands → null');
}

// 5. pickEffectiveChart: latest effectiveFrom on/before the date wins
{
  const charts = [
    { id: 'a', effectiveFrom: '2026-06-01', fatBands: FAT, snfBands: SNF, matrix: CHART.matrix },
    { id: 'b', effectiveFrom: '2026-07-01', fatBands: FAT, snfBands: SNF, matrix: CHART.matrix },
    { id: 'c', effectiveFrom: '2026-08-01', fatBands: FAT, snfBands: SNF, matrix: CHART.matrix },
  ];
  ok(pickEffectiveChart(charts, '2026-07-15').id === 'b', 'picks the newest chart effective on/before the date');
  ok(pickEffectiveChart(charts, '2026-06-15').id === 'a', 'mid-June resolves the June chart, not July');
  ok(pickEffectiveChart(charts, '2026-05-01') === null, 'no chart in force before the earliest effectiveFrom → null');
}

// 6. pickEffectiveChart: soft-deleted excluded; optional season filter
{
  const charts = [
    { id: 'a', effectiveFrom: '2026-07-01', isDeleted: true, fatBands: FAT, snfBands: SNF, matrix: CHART.matrix },
    { id: 'b', effectiveFrom: '2026-06-01', season: 'flush', fatBands: FAT, snfBands: SNF, matrix: CHART.matrix },
  ];
  ok(pickEffectiveChart(charts, '2026-07-15').id === 'b', 'soft-deleted chart is skipped');
  ok(pickEffectiveChart([{ id: 'x', effectiveFrom: '2026-07-01', season: 'lean' }], '2026-07-15', 'flush') === null, 'season filter excludes a non-matching seasonal chart');
}

// 7. priceMilk: rate × qty rounded; unpriced → amount 0
{
  const p = priceMilk([CHART], { fat: 3.7, snf: 8.7, qty: 12.5, date: '2026-07-10' });
  ok(p.rate === 36 && p.amount === 450, 'priceMilk: 36 × 12.5 = 450');
  const none = priceMilk([CHART], { fat: 4, snf: 8.5, qty: 10, date: '2026-06-01' });
  ok(none.rate === null && none.amount === 0, 'no effective chart on the date → rate null, amount 0');
  const rnd = priceMilk([{ ...CHART, matrix: [[30.333, 32], [34, 36], [38, 40]] }], { fat: 3.2, snf: 8.2, qty: 3, date: '2026-07-10' });
  ok(rnd.amount === 91, 'amount is round2 (30.333 × 3 = 90.999 → 91.00)');
}

// 8. Account resolvers: subtype marker wins, then id, then name; null when absent
{
  const withSubtype = [{ id: 'UUID-x', subtype: 'milk_procurement', nameHi: 'कुछ और' }, { id: '5108', nameHi: 'दुग्ध खरीदी लागत (प्रत्यक्ष)' }];
  ok(resolveMilkProcurementAccountId(withSubtype) === 'UUID-x', 'subtype marker resolves even when the id differs (runtime UUID account)');
  ok(resolveMilkProcurementAccountId([{ id: '5108', nameHi: 'दुग्ध खरीदी लागत (प्रत्यक्ष)' }]) === '5108', 'falls back to template id 5108');
  ok(resolveMilkProcurementAccountId([{ id: 'ZZ', nameHi: 'दुग्ध खरीदी लागत' }]) === 'ZZ', 'name hint resolves a renamed/legacy account');
  ok(resolveMilkProcurementAccountId([{ id: '4101', nameHi: 'बिक्री — सामान्य' }]) === null, 'generic sales account is NOT mistaken for milk procurement (C-A separation)');
}

// 9. Bulk-sales & payable resolvers; soft-deleted ignored
{
  ok(resolveMilkBulkSalesAccountId([{ id: 'U', subtype: 'milk_sales' }]) === 'U', 'bulk-sales resolves by subtype');
  ok(resolveMilkBulkSalesAccountId([{ id: '4101', nameHi: 'बिक्री — सामान्य' }]) === null, 'generic 4101 is not milk bulk-sales');
  ok(resolveMilkPayableAccountId([{ id: '2102', nameHi: 'देय दुग्ध भुगतान' }]) === '2102', 'milk payable resolves by id 2102');
  ok(resolveMilkProcurementAccountId([{ id: '5108', subtype: 'milk_procurement', isDeleted: true }]) === null, 'soft-deleted milk account is not resolved');
}

// ── Mirror: src/lib/posting/freezePostingLegs.ts + engineVoucher.ts + dairy/postingRules.ts ──
function freezePostingLegs(rawLegs, amount, binding, accounts) {
  if (rawLegs.length === 0) return [];
  const legs = [];
  for (const r of rawLegs) {
    const accountId = binding[r.accountSelector];
    if (!accountId) return [];
    const account = accounts.find(a => a.id === accountId);
    if (!account) return [];
    legs.push({ side: r.side, accountSelector: r.accountSelector, resolvedAccountId: account.id, accountCode: account.id, accountName: account.name, amount });
  }
  return legs;
}
function buildEngineVoucherLines(legs) {
  const lines = [];
  for (const leg of legs) { if (!leg.resolvedAccountId) return []; lines.push({ accountId: leg.resolvedAccountId, type: leg.side, amount: leg.amount.amount }); }
  return lines;
}
function resolveDairyPostingLegs(intent, amount, binding, accounts) {
  const raw = intent === 'RecogniseMilkProcurement'
    ? [{ side: 'Dr', accountSelector: 'milk.procurement.cost' }, { side: 'Cr', accountSelector: 'farmer.milk.payable' }]
    : [];
  return freezePostingLegs(raw, amount, binding, accounts);
}

// 10. Milk-procurement legs: Dr dedicated procurement / Cr milk payable, balanced & frozen
{
  const accounts = [{ id: '5108', name: 'Milk Procurement (Direct)' }, { id: '2102', name: 'Milk Payment Payable' }, { id: '5101', name: 'Purchases — General' }];
  const binding = { 'milk.procurement.cost': '5108', 'farmer.milk.payable': '2102' };
  const legs = resolveDairyPostingLegs('RecogniseMilkProcurement', { amount: 5000, currency: 'INR' }, binding, accounts);
  ok(legs.length === 2, 'two legs produced');
  const dr = legs.find(l => l.side === 'Dr'); const cr = legs.find(l => l.side === 'Cr');
  ok(dr.resolvedAccountId === '5108', 'Dr freezes to the DEDICATED milk procurement 5108, not generic 5101');
  ok(cr.resolvedAccountId === '2102', 'Cr freezes to milk payable 2102');
  const specs = buildEngineVoucherLines(legs);
  const drSum = specs.filter(s => s.type === 'Dr').reduce((s, l) => s + l.amount, 0);
  const crSum = specs.filter(s => s.type === 'Cr').reduce((s, l) => s + l.amount, 0);
  ok(drSum === crSum && drSum === 5000, 'engine voucher lines are balanced (Dr 5000 = Cr 5000)');
}

// 11. Runtime UUID binding (pre-D1 society): legs still resolve against the seeded account
{
  const accounts = [{ id: 'uuid-proc', name: 'Milk Procurement (Direct)' }, { id: 'uuid-pay', name: 'Milk Payment Payable' }];
  const binding = { 'milk.procurement.cost': 'uuid-proc', 'farmer.milk.payable': 'uuid-pay' };
  const legs = resolveDairyPostingLegs('RecogniseMilkProcurement', { amount: 100, currency: 'INR' }, binding, accounts);
  ok(legs.length === 2 && legs[0].resolvedAccountId === 'uuid-proc', 'binding built from resolvers works for UUID-id ledgers');
}

// 12. Unresolvable → [] (never post an unbalanced/unresolved voucher)
{
  const accounts = [{ id: '5108', name: 'x' }]; // payable missing from chart
  ok(resolveDairyPostingLegs('RecogniseMilkProcurement', { amount: 1, currency: 'INR' }, { 'milk.procurement.cost': '5108', 'farmer.milk.payable': '2102' }, accounts).length === 0, 'bound account missing from chart → no legs');
  ok(resolveDairyPostingLegs('RecogniseMilkProcurement', { amount: 1, currency: 'INR' }, { 'milk.procurement.cost': '5108' }, accounts).length === 0, 'unbound selector → no legs');
  ok(buildEngineVoucherLines([]).length === 0, 'no legs → no voucher lines');
}

console.log(`[dairy-test] ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
