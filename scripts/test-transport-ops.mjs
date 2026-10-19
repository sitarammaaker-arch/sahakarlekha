// Transport operations slice 1 — vehicles, trips, vehicle expenses, vehicle-wise profit.
//
// Guards: trip / collection / expense legs balance and never post zero or negative lines; loading / detention
// fold into freight when the chart lacks their heads; TDS never posts to a missing 3307; expiry badges follow
// the Insurance rule; the RULE-3 cascade set finds every live receipt; transport heads resolve / provision;
// vehicle-wise profit is computed from VOUCHER LINES with the document as the vehicle tag (cancelled,
// orphan, untagged and out-of-window vouchers handled); registration (export registry, nav, hub, routes,
// noindex); and source guards on TransportOpsContext (FY lock, voucher-first save + rollback, cascades,
// no costCentreId / workOrderId overload, no hardcoded GST rate) and migration 128.
//
// Run: node scripts/test-transport-ops.mjs   (npm run test:transport-ops)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as pathResolve } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const base = pathResolve(SRC, spec.slice(2));
          for (const cand of [base + '.ts', base + '.tsx', base + '/index.ts', base]) {
            if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
          }
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const cand of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) {
            const u = new URL(cand, ctx.parentURL);
            if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true };
          }
        }
        return next(spec, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

const T = await import(abs('../src/lib/transport/trips.ts'));
const A = await import(abs('../src/lib/transport/accounts.ts'));
const P = await import(abs('../src/lib/transport/vehicleProfit.ts'));
const PROV = await import(abs('../src/lib/domainAccounts/provisioning.ts'));
const { TRANSPORT_EXTRA_ACCOUNTS } = await import(abs('../src/lib/templates/transport.ts'));
const REG = await import(abs('../src/lib/export/registry.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)})`);
const read = (rel) => readFileSync(pathResolve(HERE, '..', rel), 'utf8');
const sumSide = (legs, side) => Math.round(legs.filter(l => l.type === side).reduce((s, l) => s + l.amount, 0) * 100);

// ── 1. Trip posting legs ──────────────────────────────────────────────────────
{
  const ids = { freight: '4501', loading: '4503', detention: '4504' };
  const legs = T.tripLegs('CUST', { freight: 12000, loading: 800, detention: 500.5 }, ids);
  eq(legs, [
    { accountId: 'CUST', type: 'Dr', amount: 13300.5 },
    { accountId: '4501', type: 'Cr', amount: 12000 },
    { accountId: '4503', type: 'Cr', amount: 800 },
    { accountId: '4504', type: 'Cr', amount: 500.5 },
  ], 'trip: Dr customer total, Cr freight / loading / detention');
  ok(sumSide(legs, 'Dr') === sumSide(legs, 'Cr'), 'trip legs balance');
  eq(T.tripLegs('CUST', { freight: 5000 }, ids).length, 2, 'freight only → 2 legs (no zero lines)');
  const fb = T.tripLegs('CUST', { freight: 1000, loading: 100, detention: 50 }, { freight: '4501', loading: null, detention: null });
  eq(fb, [{ accountId: 'CUST', type: 'Dr', amount: 1150 }, { accountId: '4501', type: 'Cr', amount: 1150 }], 'no loading/detention head → folded into freight, never dropped');
  eq(T.tripLegs('CUST', { freight: 0, loading: 100 }, ids), [], 'freight 0 → not postable');
  eq(T.tripLegs('CUST', { freight: 100, loading: -5 }, ids), [], 'negative component → not postable');
  eq(T.tripLegs('', { freight: 100 }, ids), [], 'no customer ledger → not postable');
  ok(T.validateTripCharges({ freight: 0 }) !== null && T.validateTripCharges({ freight: 10 }) === null, 'validateTripCharges');
  eq(T.tripAmount({ freight: 0.1, loading: 0.2 }), 0.3, 'tripAmount rounds to paise');
  const r = T.tripLegs('C', { freight: 0.1, loading: 0.2, detention: 0.3 }, ids);
  ok(sumSide(r, 'Dr') === sumSide(r, 'Cr') && sumSide(r, 'Dr') === 60, 'float components still balance in paise');
}

// ── 2. Collection + expense legs, status, numbering ───────────────────────────
{
  const res = T.collectionLegs({ outstanding: 10000, amount: 10000, tds: 200, cashOrBankAccountId: '3301', customerAccountId: 'CUST', tdsAccountId: '3307' });
  eq(res.legs, [
    { accountId: '3301', type: 'Dr', amount: 9800 },
    { accountId: '3307', type: 'Dr', amount: 200 },
    { accountId: 'CUST', type: 'Cr', amount: 10000 },
  ], 'collection: net cash + TDS receivable / Cr customer gross');
  ok('error' in T.collectionLegs({ outstanding: 100, amount: 150, cashOrBankAccountId: 'c', customerAccountId: 'x' }), 'over-collection refused');
  ok('error' in T.collectionLegs({ outstanding: 100, amount: 0, cashOrBankAccountId: 'c', customerAccountId: 'x' }), 'zero collection refused');
  ok('error' in T.collectionLegs({ outstanding: 100, amount: 50, tds: 60, cashOrBankAccountId: 'c', customerAccountId: 'x', tdsAccountId: '3307' }), 'TDS > amount refused');
  ok('error' in T.collectionLegs({ outstanding: 100, amount: 50, tds: 5, cashOrBankAccountId: 'c', customerAccountId: 'x', tdsAccountId: null }), 'TDS without a 3307 ledger refused (never posted to a missing account)');
  eq(T.collectionLegs({ outstanding: 100, amount: 100, tds: 100, cashOrBankAccountId: 'c', customerAccountId: 'x', tdsAccountId: '3307' }).legs.length, 2, 'fully withheld → no zero cash line');
  eq([T.tripStatus(100, 0), T.tripStatus(100, 40), T.tripStatus(100, 99.999)], ['unpaid', 'partial', 'paid'], 'tripStatus');
  eq(T.expenseLegs('5701', '3301', 2500), [{ accountId: '5701', type: 'Dr', amount: 2500 }, { accountId: '3301', type: 'Cr', amount: 2500 }], 'expense: Dr head / Cr cash');
  eq(T.expenseLegs('5701', '3301', 0), [], 'zero expense → not postable');
  eq(T.nextDocNo('TRP', ['TRP/0001', 'TRP/0009', 'VEX/0050', undefined]), 'TRP/0010', 'nextDocNo per series');
  eq(T.nextDocNo('VEX', []), 'VEX/0001', 'first number');
}

// ── 3. Expiry badges (Insurance rule) ─────────────────────────────────────────
{
  const today = '2026-10-19';
  eq(T.expiryState('2026-10-18', today), { state: 'expired', days: -1 }, 'yesterday → expired');
  eq(T.expiryState('2026-10-19', today).state, 'soon', 'today → soon (0 days)');
  eq(T.expiryState('2026-11-18', today), { state: 'soon', days: 30 }, '30 days → soon');
  eq(T.expiryState('2026-11-19', today).state, 'ok', '31 days → ok');
  eq(T.expiryState(undefined, today).state, 'none', 'no date → none');
  eq(T.expiryState('', today).state, 'none', "cleared ('') → none");
}

// ── 4. RULE 3 cascade set ─────────────────────────────────────────────────────
{
  const trip = { id: 't1', voucherId: 'v-trip', collectionVoucherIds: ['v-c1', 'v-gone'] };
  const vouchers = [
    { id: 'v-trip' },
    { id: 'v-c1', refType: P.TRIP_COLLECTION_REF, refId: 't1' },
    { id: 'v-c2', refType: P.TRIP_COLLECTION_REF, refId: 't1' },                 // not in the list — still found
    { id: 'v-c3', refType: P.TRIP_COLLECTION_REF, refId: 't1', isDeleted: true }, // already cancelled — skipped
    { id: 'v-other', refType: P.TRIP_COLLECTION_REF, refId: 't2' },
    { id: 'v-gone', isDeleted: true },
  ];
  const c = T.tripCascadeVoucherIds(trip, vouchers, P.TRIP_COLLECTION_REF);
  eq(c.tripVoucherId, 'v-trip', 'cascade: the trip voucher');
  eq(c.collectionIds.sort(), ['v-c1', 'v-c2'], 'cascade: every LIVE collection (list ∪ refId), not cancelled ones, not other trips');
  eq(T.tripCascadeVoucherIds({ id: 't1', voucherId: 'v-trip' }, [{ id: 'v-trip', isDeleted: true }], P.TRIP_COLLECTION_REF).tripVoucherId, null, 'already-cancelled trip voucher is not cancelled twice');
}

// ── 5. Accounts: resolver + provisioning specs ────────────────────────────────
{
  const chart = TRANSPORT_EXTRA_ACCOUNTS;
  const ids = A.resolveTransportAccounts(chart);
  eq([ids.freight, ids.loading, ids.detention, ids.diesel, ids.hiredVehicle], ['4501', '4503', '4504', '5701', '5708'], 'transport chart resolves by template id');
  eq(A.resolveTransportAccountId([{ id: '4501', name: 'Something else', type: 'expense', isGroup: false }], 'freight'), null, 'same id, wrong type → not freight (ids differ across charts)');
  eq(A.resolveTransportAccountId([{ id: 'uuid-1', name: 'freight income', type: 'income', isGroup: false }], 'freight'), 'uuid-1', 'hand-made ledger found by name');
  eq(A.resolveTransportAccountId([{ id: 'g', name: 'Freight Income', type: 'income', isGroup: true }], 'freight'), null, 'a group is never a posting ledger');
  const specs = PROV.DOMAIN_ACCOUNT_SPECS.filter(s => s.capability === 'transport');
  eq(specs.length, 12, '12 transport provisioning specs (4 income + 8 expense)');
  eq(PROV.planMissingDomainAccounts(chart, new Set(['transport'])).length, 0, 'Transport society chart → nothing to provision');
  eq(PROV.planMissingDomainAccounts([{ id: '4000', name: 'Income', type: 'income', isGroup: true }], new Set(['transport'])).length, 12, 'multipurpose chart (no 45xx/57xx) → 12 planned');
  eq(PROV.planMissingDomainAccounts([], new Set(['pos_billing'])).filter(s => s.capability === 'transport').length, 0, 'no transport capability → none planned');
  const m = PROV.materialiseDomainAccount(specs.find(s => s.key === 'transport.freight'), [{ id: '4000', isGroup: true }]);
  ok(m.id === '4501' && m.template.parentId === '4000' && m.template.type === 'income' && !m.template.isGroup, 'freight provisions as 4501 under Income (4000) when the chart has no 4500 group');
  const m2 = PROV.materialiseDomainAccount(specs.find(s => s.key === 'transport.diesel'), [{ id: '5000', isGroup: true }, { id: '5701', isGroup: false }]);
  ok(m2.id === undefined && m2.template.parentId === '5000', '5701 taken by another ledger → fresh id, parent 5000');
}

// ── 6. Vehicle-wise profit (RULE 2: from voucher lines) ───────────────────────
{
  const accounts = [
    { id: '4501', type: 'income' }, { id: '4503', type: 'income' }, { id: '5701', type: 'expense' }, { id: '5703', type: 'expense' },
    { id: '5503', type: 'expense' }, { id: 'CUST', type: 'asset' }, { id: '3301', type: 'asset' }, { id: '3110', type: 'asset' }, { id: '5301', type: 'expense' },
  ];
  const vehicles = [
    { id: 'A', regNo: 'HR-01', vehicleType: 'truck', status: 'active', assetId: 'asset-A', createdAt: '' },
    { id: 'B', regNo: 'HR-02', vehicleType: 'truck', status: 'active', createdAt: '' },
    { id: 'Z', regNo: 'HR-99', vehicleType: 'truck', status: 'active', isDeleted: true, createdAt: '' },
  ];
  const trips = [
    { id: 't1', vehicleId: 'A', voucherId: 'v1' }, { id: 't2', vehicleId: 'B', voucherId: 'v2' },
    { id: 't3', vehicleId: 'A', voucherId: 'v3' }, { id: 't4', vehicleId: 'B', voucherId: 'v-overlay-lost' },
  ];
  const expenses = [{ id: 'e1', vehicleId: 'A', voucherId: 'v4' }, { id: 'e2', vehicleId: 'B', voucherId: 'v5' }];
  const assets = [{ id: 'asset-A', voucherIds: ['v-dep'] }];
  let n = 0;
  const L = (accountId, type, amount) => ({ id: `l${++n}`, accountId, type, amount });
  const vouchers = [
    { id: 'v1', date: '2026-05-01', refType: P.TRIP_REF, refId: 't1', lines: [L('CUST', 'Dr', 10800), L('4501', 'Cr', 10000), L('4503', 'Cr', 800)] },
    { id: 'v2', date: '2026-05-02', refType: P.TRIP_REF, refId: 't2', lines: [L('CUST', 'Dr', 6000), L('4501', 'Cr', 6000)] },
    { id: 'v3', date: '2026-05-03', refType: P.TRIP_REF, refId: 't3', isDeleted: true, lines: [L('CUST', 'Dr', 9999), L('4501', 'Cr', 9999)] },
    { id: 'v-overlay-lost', date: '2026-05-04', lines: [L('CUST', 'Dr', 1500), L('4501', 'Cr', 1500)] },
    { id: 'v4', date: '2026-05-05', refType: P.EXPENSE_REF, refId: 'e1', lines: [L('5701', 'Dr', 3000), L('3301', 'Cr', 3000)] },
    { id: 'v5', date: '2026-05-06', refType: P.EXPENSE_REF, refId: 'e2', debitAccountId: '5703', creditAccountId: '3301', amount: 7000 },
    { id: 'v-dep', date: '2027-03-31', lines: [L('5503', 'Dr', 1200), L('3110', 'Cr', 1200)] },
    { id: 'v-col', date: '2026-05-07', refType: P.TRIP_COLLECTION_REF, refId: 't1', lines: [L('3301', 'Dr', 10800), L('CUST', 'Cr', 10800)] },
    { id: 'v-plain', date: '2026-06-01', lines: [L('5701', 'Dr', 400), L('3301', 'Cr', 400)] },
    { id: 'v-office', date: '2026-06-01', lines: [L('5301', 'Dr', 900), L('3301', 'Cr', 900)] },
    { id: 'v-orphan', date: '2026-06-02', refType: P.TRIP_REF, refId: 'deleted-trip', lines: [L('CUST', 'Dr', 250), L('4501', 'Cr', 250)] },
    { id: 'v-old', date: '2026-03-31', refType: P.TRIP_REF, refId: 't1', lines: [L('CUST', 'Dr', 777), L('4501', 'Cr', 777)] },
  ];
  const base = { vouchers, accounts, vehicles, trips, expenses, assets, transportIncomeIds: ['4501', '4503'], transportExpenseIds: ['5701', '5703'] };
  const r = P.computeVehicleProfit({ ...base, from: '2026-04-01', to: '2027-03-31' });
  const a = r.rows.find(x => x.vehicleId === 'A'); const b = r.rows.find(x => x.vehicleId === 'B');
  eq(r.rows.map(x => x.vehicleId).sort(), ['A', 'B'], 'deleted vehicle has no row');
  eq([a.trips, a.income, a.runningCost, a.depreciation, a.net], [1, 1080000, 300000, 120000, 660000], 'A: 1 live trip (cancelled one excluded), income incl. loading, diesel, linked-asset depreciation');
  eq(a.costByAccount, { '5701': 300000 }, 'A: cost by head');
  eq([b.trips, b.income, b.runningCost, b.net], [2, 750000, 700000, 50000], 'B: trip found via voucherId when refType was lost; header-only expense voucher counted');
  eq(r.unallocatedIncome, 25000, 'orphan trip voucher (document gone) → unallocated income, not a vehicle');
  eq(r.unallocatedCost, 40000, 'untagged diesel → unallocated; office expense is not a transport head');
  eq(r.totals.net, a.net + b.net, 'total = sum of vehicles');
  ok(r.rows[0].vehicleId === 'A', 'sorted by net, best first');
  const all = P.computeVehicleProfit(base);
  eq(all.rows.find(x => x.vehicleId === 'A').income, 1080000 + 77700, 'no window → the pre-FY trip counts too');
}

// ── 7. Registration: export registry, nav, hubs, routes, noindex ──────────────
{
  const keys = REG.REGISTRY.filter(e => e.domain === 'transport').map(e => e.key).sort();
  eq(keys, ['transport_trip', 'transport_vehicle', 'transport_vehicle_expense'], 'export registry declares the 3 transport tables');
  ok(REG.REGISTRY.filter(e => e.domain === 'transport').every(e => e.capability === 'transport' && e.optionalTable === true && e.backupPolicy === 'full'), 'gated on transport, optionalTable until migration 128 runs, full backup');
  const catalog = read('src/lib/navigation/moduleCatalog.ts');
  const routes = [...catalog.matchAll(/route: '([^']+)', domain: 'transport', requiredCapabilities: \['transport'\]/g)].map(m => m[1]).sort();
  eq(routes, ['/transport', '/transport-trips', '/transport-vehicles', '/vehicle-expenses', '/vehicle-profit'], 'transport nav group, every page gated on the transport capability');
  ok(/domain: 'transport' \}/.test(read('src/lib/navigation/hubs.ts')), 'Society-work hub has a Transport section');
  const app = read('src/App.tsx');
  for (const rt of ['/transport-vehicles', '/transport-trips', '/vehicle-expenses', '/vehicle-profit']) ok(app.includes(`path="${rt}"`), `route ${rt} registered`);
  ok(/<TransportOpsProvider>/.test(app), 'TransportOpsProvider mounted');
  const vercel = read('vercel.json');
  for (const rt of ['transport-vehicles', 'transport-trips', 'vehicle-expenses', 'vehicle-profit']) ok(vercel.includes(rt), `noindex covers ${rt}`);
}

// ── 8. Source guards on the context (RULE 1 / 3 / 6, the tag dimension) ───────
{
  const src = read('src/contexts/TransportOpsContext.tsx');
  const fn = (name) => { const i = src.indexOf(`const ${name} = useCallback(`); if (i < 0) return ''; const j = src.indexOf('\n  }, [', i); return src.slice(i, j); };
  for (const name of ['addVehicle', 'updateVehicle', 'deleteVehicle', 'addTrip', 'recordTripCollection', 'deleteTrip', 'addVehicleExpense', 'deleteVehicleExpense']) {
    const body = fn(name);
    ok(body.length > 0, `${name} exists`);
    ok(/if \(guardFYLocked\(\)\) return/.test(body.slice(0, 700)), `${name}: FY-lock guard at the top (RULE 6)`);
  }
  for (const name of ['addTrip', 'addVehicleExpense']) {
    const body = fn(name);
    ok(/onSaved: \(\) => \{\s*const \w+ = doc\.\w+!;\s*supabase\.from\(/.test(body), `${name}: the row is written only after the voucher is durably saved`);
    ok(/onFailed: \(\) => set\w+\(prev => prev\.filter/.test(body), `${name}: a refused voucher removes the optimistic row (RULE 1)`);
    ok(/if \(error\)[\s\S]*?cancelVoucher\([\s\S]*?viaParent: true/.test(body), `${name}: a refused row cancels its voucher (RULE 1)`);
    ok(!/costCentreId|workOrderId/.test(body), `${name}: does not overload costCentreId / workOrderId`);
  }
  ok(/onFailed: \(\) => setTrips\(prev => prev\.map\(t => t\.id === trip\.id \? apply\(t, -1\)/.test(fn('recordTripCollection')), 'collection: refused receipt reverts paidAmount');
  ok(/tripCascadeVoucherIds\(old, vouchers, TRIP_COLLECTION_REF\)/.test(fn('deleteTrip')), 'deleteTrip cascades through tripCascadeVoucherIds (RULE 3)');
  ok(/cancelVoucher\(old\.voucherId/.test(fn('deleteVehicleExpense')), 'deleteVehicleExpense cancels its voucher (RULE 3)');
  ok(/liveTrips \+ liveExp > 0/.test(fn('deleteVehicle')), 'deleteVehicle blocked while trips / expenses reference it (RULE 3)');
  ok(/registerVoucherOwner\('transport'/.test(src), 'transport vouchers are owned (cancel only through the document)');
  const tripsCode = read('src/lib/transport/trips.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  ok(!/gst/i.test(tripsCode), 'no GST rate / rule in the trip posting code (unsourced — GST off in slice 1)');
}

// ── 9. Migration 128 ──────────────────────────────────────────────────────────
{
  const up = read('supabase/migrations/128_transport_operations.sql');
  const down = read('supabase/migrations/128_transport_operations_down.sql');
  const sql = read('supabase-tables.sql');
  for (const t of ['transport_vehicles', 'transport_trips', 'transport_vehicle_expenses']) {
    ok(up.includes(`create table if not exists public.${t}`), `128 creates ${t}`);
    ok(sql.includes(`create table if not exists ${t} (`), `supabase-tables.sql declares ${t}`);
    ok(down.includes(`drop table if exists public.${t}`), `down drops ${t}`);
  }
  ok(/jwt_can_write\(\)/.test(up) && /jwt_can_delete\(\)/.test(up) && !/using \(true\)/i.test(up), 'RLS: tenant-scoped, write/delete role checks, nothing permissive');
  ok((up.match(/jurisdiction\s+text/g) || []).length === 3, 'every table carries jurisdiction (T-01 stamping)');
  ok(/"collectionVoucherIds" jsonb/.test(up) && /"collectionVoucherIds" jsonb/.test(sql), 'trip receipts are linked (ownership)');
}

console.log(`Transport ops: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
