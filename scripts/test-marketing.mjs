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

console.log(`[marketing-test] ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
