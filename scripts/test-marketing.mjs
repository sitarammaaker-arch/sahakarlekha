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
const { buildProcurementRegister, buildCommoditySummary, settlementTotals, countableLots } = await import(abs('../src/lib/marketing/registers.ts'));

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
