// Unit tests for Marketing — the effective-dated MSP rate resolver (src/lib/marketing/msp.ts) and the
// procurement register builders (src/lib/marketing/registers.ts). Imports the REAL TS modules via the
// '@/' loader (the earlier hand-written JS copies could drift from the source).
// Run: node scripts/test-marketing.mjs   (exit 1 on any failure)
process.env.TZ = 'Asia/Kolkata';   // register dates are the IST day
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

const { pickEffectiveMspRate } = await import(abs('../src/lib/marketing/msp.ts'));
const { buildProcurementRegister, buildCommoditySummary, settlementTotals, countableLots, buildArhtiyaRegister } = await import(abs('../src/lib/marketing/registers.ts'));
const { bardanaBalances } = await import(abs('../src/lib/marketing/bardana.ts'));
const AB = await import(abs('../src/lib/marketing/agencyBilling.ts'));

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

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
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
    { status: 'approved', gross: rate(48500), deductionLines: [{ amount: rate(970) }], netPayable: rate(47530), amountPaid: rate(47530) },
    { status: 'approved', gross: rate(72750), deductionLines: [{ amount: rate(1455) }, { amount: rate(500) }], netPayable: rate(70795), amountPaid: rate(30000) },
    { status: 'approved', gross: rate(1000), deductionLines: [], netPayable: rate(1000), amountPaid: rate(0), isDeleted: true },
    { status: 'draft', gross: rate(9000), deductionLines: [], netPayable: rate(9000), amountPaid: rate(0) },
  ];
  const t = settlementTotals(S);
  ok(t.count === 2, 'settlement totals: soft-deleted AND draft excluded (2 of 4) — a draft is not owed yet');
  ok(t.gross === 121250 && t.deductions === 2925, 'settlement totals: gross 121250, deductions 2925');
  ok(t.net === 118325 && t.paid === 77530 && t.outstanding === r2(118325 - 77530), 'settlement totals: net/paid/outstanding tie out');
}

// 10. Batch B — cancelled lots are not counted; the business date leads the register
{
  const c = countableLots([{ id: 'A' }, { id: 'B', cancelledAt: '2026-10-25T10:00:00Z' }], new Set(['A', 'B']), new Set());
  ok(c.length === 1 && c[0].id === 'A', 'cancelled lot dropped from the registers');
  const reg = buildProcurementRegister([{ ...LOTS[0], lotDate: '2026-01-15' }]);
  ok(reg.rows[0].date === '2026-01-15', 'register uses lotDate when set');
}

// 11. D2a — arhtiya register (dami computed, not posted) and bardana count balances
{
  const lots = [
    { ...LOTS[0], arhtiyaId: 'A1' },                       // 20 qtl × 2425
    { ...LOTS[1], arhtiyaId: 'A1' },                       // 30 qtl × 2425
    { ...LOTS[2], arhtiyaId: 'A2' },                       // 10 qtl × 5650
    { ...LOTS[0], id: 'L9' },                              // no arhtiya
  ];
  const reg = buildArhtiyaRegister(lots, [{ id: 'A1', damiRate: 2.5 }, { id: 'A2', damiRate: 46, damiBasis: 'perQtl' }]);
  const a1 = reg.find(r => r.arhtiyaId === 'A1'), a2 = reg.find(r => r.arhtiyaId === 'A2');
  ok(reg.length === 2 && a1.lots === 2 && a1.qty === 50 && a1.value === 121250, 'arhtiya A1: 2 lots, 50 qtl, ₹1,21,250 (lot without arhtiya skipped)');
  ok(a1.dami === 3031.25 && a2.dami === 460, 'dami: 2.5% of 1,21,250 = 3,031.25; ₹46/qtl × 10 = 460');
  const mv = (direction, partyType, partyId, bags) => ({ id: Math.random() + '', date: '2026-04-01', direction, partyType, partyId, bags, createdAt: '', updatedAt: '' });
  const b = bardanaBalances([mv('in', 'agency', 'AG', 1000), mv('out', 'farmer', 'F1', 300), mv('in', 'farmer', 'F1', 40), mv('out', 'agency', 'AG', 200), mv('out', 'farmer', 'F2', 0)]);
  ok(b.inHand === 540, 'in hand = 1000 − 300 + 40 − 200 = 540');
  ok(b.parties.find(p => p.partyId === 'F1').balance === 260, 'farmer still holds 300 − 40 = 260 bags');
  ok(b.parties.find(p => p.partyId === 'AG').balance === 800, 'society owes the agency 1000 − 200 = 800 bags');
  ok(!b.parties.some(p => p.partyId === 'F2'), 'a 0-bag entry is ignored');
}

// 12. D3 — dispatch, shortage, agency bill, matching, season reconciliation
{
  const t = AB.dispatchTotals([{ quantity: { value: 60 }, value: 145500, bags: 120 }, { quantity: { value: 40 }, value: 97000, bags: 80 }]);
  ok(t.qty === 100 && t.value === 242500 && t.bags === 200 && t.rate === 2425, 'dispatch totals: 100 qtl, ₹2,42,500, 200 bags, avg ₹2,425');
  const sh = AB.shortageOf(100, 242500, 99.5);
  ok(sh.qty === 0.5 && sh.value === 1212.5, 'shortage 0.5 qtl at avg MSP = ₹1,212.50');
  ok(AB.shortageOf(100, 242500, 100).value === 0 && AB.shortageOf(100, 242500, 101) === null && AB.shortageOf(100, 242500, -1) === null, 'no shortage / over-acceptance and negative refused');
  const base = AB.billBase([{ dispatchedQty: 100, dispatchedValue: 242500, acceptedQty: 99.5, shortageValue: 1212.5 }]);
  ok(base.qty === 99.5 && base.value === 241287.5, 'bill covers the ACCEPTED qty / value (shortage removed)');
  ok(AB.incidentalAmount('perQtl', 46, base) === 4577 && AB.incidentalAmount('percent', 2, base) === 4825.75 && AB.incidentalAmount('fixed', 500, base) === 500, 'incidentals: ₹/qtl, % of MSP, fixed');
  const tot = AB.billTotals(base.value, [{ amount: 4577 }, { amount: 500 }]);
  ok(tot.incidentalTotal === 5077 && tot.total === 246364.5, 'bill total = MSP + incidentals');
  const bills = [
    { id: 'B2', agencyId: 'AG', date: '2026-05-10', billNo: 'ABL/0002', total: 1000, status: 'approved' },
    { id: 'B1', agencyId: 'AG', date: '2026-05-01', billNo: 'ABL/0001', total: 3000, status: 'approved' },
    { id: 'BD', agencyId: 'AG', date: '2026-05-02', billNo: 'ABL/0003', total: 9999, status: 'draft' },
    { id: 'BX', agencyId: 'AG', date: '2026-05-03', billNo: 'ABL/0004', total: 9999, status: 'approved', isDeleted: true },
  ];
  const m = AB.matchReceiptsToBills(bills, [{ agencyId: 'AG', amount: 2500 }, { agencyId: 'AG', amount: 1200 }, { agencyId: 'OTHER', amount: 50 }]);
  ok(m.byBill.B1.received === 3000 && m.byBill.B1.outstanding === 0, 'FIFO: oldest bill B1 covered first');
  ok(m.byBill.B2.received === 700 && m.byBill.B2.outstanding === 300, 'then B2 partly (3,700 − 3,000)');
  ok(!m.byBill.BD && !m.byBill.BX, 'draft and deleted bills not matched');
  ok(m.unapplied.AG === 0 && m.unapplied.OTHER === 50, 'unapplied per agency');
  ok(AB.nextDocNo('DSP', ['DSP/0003', 'DSP/0010', 'X/0099', undefined]) === 'DSP/0011' && AB.nextDocNo('ABL', []) === 'ABL/0001', 'document numbers');
  const lots = [{ id: 'L1', seasonId: 'R', quantity: { value: 60 }, value: 145500 }, { id: 'L2', seasonId: 'R', quantity: { value: 40 }, value: 97000 }, { id: 'L3', seasonId: 'R', quantity: { value: 10 }, value: 24250 }];
  const ds = [{ id: 'D1', lotIds: ['L1', 'L2'], dispatchedQty: 100, dispatchedValue: 242500, acceptedQty: 99.5, shortageQty: 0.5, shortageValue: 1212.5, status: 'accepted' }];
  const rec = AB.seasonReconciliation(lots, ds, [{ id: 'B', dispatchIds: ['D1'], status: 'approved', incidentalTotal: 5077 }]);
  const r = rec[0];
  ok(r.lots === 3 && r.qty === 110 && r.dispatchedQty === 100 && r.acceptedQty === 99.5 && r.undispatchedQty === 10, 'recon: bought 110, sent 100, accepted 99.5, not sent 10');
  ok(r.shortageValue === 1212.5 && r.billedValue === 241287.5 && r.unbilledValue === 0 && r.incidentals === 5077, 'recon: shortage, billed, incidentals');
  const rec2 = AB.seasonReconciliation(lots, ds, []);
  ok(rec2[0].billedValue === 0 && rec2[0].unbilledValue === 241287.5, 'recon: accepted but unbilled shows as unbilled');
}

// 9. Batch A — registers count only posted, non-rejected lots; status label; local (IST) date
{
  const lots = [...LOTS, { id: 'L4', farmerId: 'F3', cropId: 'wheat', quantity: qtl(99), mspRate: rate(2425), operationalStatus: 'created', createdAt: '2026-02-20T09:00:00Z' }];
  const c = countableLots(lots, new Set(['L1', 'L2', 'L3', 'L4']), new Set(['L3']));
  ok(c.map(l => l.id).join(',') === 'L1,L2,L4', 'rejected lot (L3) dropped');
  const c2 = countableLots(lots, new Set(['L1', 'L2']), new Set());
  ok(c2.length === 2 && buildCommoditySummary(c2)[0].qty === 50, 'unposted lots (L3, L4) not counted in qty/value');
  const reg = buildProcurementRegister(c2, undefined, undefined, l => `stage:${l.id}`);
  ok(reg.rows.every(r => r.status === `stage:${r.lotId}`), 'status column shows the lot stage, not the stored "created"');
  const late = buildProcurementRegister([{ ...LOTS[0], createdAt: '2026-03-31T20:00:00Z' }]);
  ok(late.rows[0].date === '2026-04-01', 'a lot entered 01:30 IST on 1 April is dated 1 April (was the UTC 31 March)');
}

console.log(`[marketing-test] ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
