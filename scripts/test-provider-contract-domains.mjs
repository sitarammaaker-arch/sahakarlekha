// TEST-01 slice 3 (product audit 2026-11-17) — provider contract for the six DOMAIN providers (Housing, Marketing,
// Labour, Dairy, Transport, Consumer), each the shipped code mounted inside the real DataProvider
// (scripts/lib/provider-harness.mjs, `domains: true`; modules switched on by plan-sourced capability rows).
//   · every domain update* (20 of them): refused → old value back + exactly one destructive toast; accepted → only
//     the changed column (+ updatedAt where the entity stamps it) is sent (ARCH-04); 0 rows updated = failure
//   · add*: refused → the new row leaves the screen with exactly one destructive toast
//   · Labour addDepartment refused → its new receivable sub-ledger is deleted too (was left as an orphan: the
//     rollback called a stale deleteAccount that could not see the account — fixed with this test)
// Run: node scripts/test-provider-contract-domains.mjs
import { mountDataProvider } from './lib/provider-harness.mjs';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };
const qerr = console.error, qinfo = console.info, qwarn = console.warn;
console.error = () => {}; console.info = () => {}; console.warn = () => {};   // refused writes are logged — expected

const S = 'SOC-H';
// [domain, update fn, table, state key, field to edit]
const UPDATES = [
  ['dairy', 'updateRateChart', 'dairy_rate_charts', 'rateCharts', 'name'],
  ['housing', 'updateChargeHead', 'housing_charge_heads', 'chargeHeads', 'name'],
  ['housing', 'updateHousingFlat', 'housing_flats', 'housingFlats', 'ownerName'],
  ['housing', 'updateComplaint', 'housing_complaints', 'complaints', 'description'],
  ['housing', 'updateParking', 'housing_parking', 'parkingSlots', 'slotNo'],
  ['housing', 'updateInsurance', 'housing_insurance', 'insurances', 'insurer'],
  ['housing', 'updateAmc', 'housing_amc', 'amcs', 'vendor'],
  ['housing', 'updateDocument', 'housing_documents', 'documents', 'title'],
  ['housing', 'updateBuilding', 'housing_buildings', 'buildings', 'name'],
  ['labour', 'updateWorker', 'workers', 'workers', 'phone'],
  ['labour', 'updateDepartment', 'departments', 'departments', 'phone'],
  ['marketing', 'updateCrop', 'procurement_crops', 'crops', 'name'],
  ['marketing', 'updateVariety', 'procurement_varieties', 'varieties', 'name'],
  ['marketing', 'updateSeason', 'procurement_seasons', 'seasons', 'name'],
  ['marketing', 'updateAgency', 'procurement_agencies', 'agencies', 'name'],
  ['marketing', 'updateCentre', 'procurement_centres', 'centres', 'name'],
  ['marketing', 'updateDeductionRule', 'procurement_deduction_rules', 'deductionRules', 'name'],
  ['marketing', 'updateArhtiya', 'procurement_arhtiyas', 'arhtiyas', 'name'],
  ['marketing', 'updateTransporter', 'marketing_transporters', 'transporters', 'name'],
  ['transport', 'updateVehicle', 'transport_vehicles', 'vehicles', 'regNo'],
];
const caps = ['housing', 'labour', 'dairy_collection', 'transport'].map((c, i) => ({ id: `cap${i}`, society_id: S, capability: c, mode: 'grant', source: 'plan' }));
const seed = { society_capabilities: caps };
for (const [, , t, , f] of UPDATES) seed[t] = [{ id: `${t}-1`, name: 'Old', [f]: 'Old', status: 'active', society_id: S }];

const h = await mountDataProvider({ domains: true, seed });
await h.settle(100);
const run = async (fn) => { await h.act(async () => { fn(); }); await h.settle(); };
for (const d of ['housing', 'marketing', 'labour', 'dairy', 'transport', 'consumer']) ok(!!h.domain(d), `the ${d} provider mounted inside the real DataProvider`);

// ── every domain update* ──
for (const [d, fn, t, key, f] of UPDATES) {
  const id = `${t}-1`;
  const row = () => h.domain(d)[key].find((r) => r.id === id);
  ok(!!row(), `${fn}: the seeded ${t} row loaded (module switched on)`);
  if (!row()) continue;

  h.reset(); h.respond((q) => (q.table === t && q.op === 'update' ? { data: null, error: { message: 'harness: refused' } } : undefined));
  await run(() => h.domain(d)[fn](id, { [f]: 'New' }));
  ok(row()[f] === 'Old' && h.destructive().length === 1, `${fn} refused: the old ${f} is back + one destructive toast (got ${row()[f]}, ${h.destructive().length} toasts)`);

  h.reset(); h.respond((q) => (q.table === t && q.op === 'update' ? { data: [], error: null } : undefined));
  await run(() => h.domain(d)[fn](id, { [f]: 'New' }));
  ok(row()[f] === 'Old' && h.destructive().length === 1, `${fn}: 0 rows updated (row gone / RLS) is a failure, rolled back`);

  h.reset();
  await run(() => h.domain(d)[fn](id, { [f]: 'New' }));
  const w = h.writes(t);
  const keys = w.length === 1 ? Object.keys(w[0].payload).filter((k) => k !== 'updatedAt') : [];
  ok(String(row()[f]).toLowerCase() === 'new' && w.length === 1 && w[0].op === 'update' && keys.length === 1 && keys[0] === f, `${fn} accepted: only ${f} is sent (got ${JSON.stringify(w.map((q) => q.payload))})`);
}

// ── add*: refused → removed + one toast ──
const ADDS = [
  ['labour', 'addWorker', 'workers', 'workers', { name: 'Mohan', phone: '1', dailyWage: 400, status: 'active', joinDate: '2024-06-01' }],
  ['transport', 'addVehicle', 'transport_vehicles', 'vehicles', { regNo: 'HR-09-X-1', type: 'truck', status: 'active' }],
  ['marketing', 'addCrop', 'procurement_crops', 'crops', { name: 'Wheat', code: 'WHT' }],
  ['housing', 'addBuilding', 'housing_buildings', 'buildings', { name: 'Tower A' }],
  ['dairy', 'addRateChart', 'dairy_rate_charts', 'rateCharts', { name: 'Cow', milkType: 'cow', effectiveFrom: '2024-06-01', fatRate: 7, snfRate: 0, slabs: [] }],
];
for (const [d, fn, t, key, data] of ADDS) {
  const n0 = h.domain(d)[key].length;
  h.reset(); h.respond((q) => (q.table === t && ['insert', 'upsert'].includes(q.op) ? { data: null, error: { message: 'harness: refused' } } : undefined));
  await run(() => h.domain(d)[fn](data));
  ok(h.writes(t).length === 1, `${fn}: the row was sent (validation passed)`);
  ok(h.domain(d)[key].length === n0 && h.destructive().length === 1, `${fn} refused: the new row leaves the screen + one destructive toast (rows ${n0}→${h.domain(d)[key].length}, ${h.destructive().length} toasts)`);
  h.reset();
  await run(() => h.domain(d)[fn](data));
  ok(h.domain(d)[key].length === n0 + 1 && h.destructive().length === 0, `${fn} accepted: the row stays`);
}

// ── Labour addDepartment: the sub-ledger follows the department ──
{
  const accBefore = h.ctx().accounts.length;
  h.reset(); h.respond((q) => (q.table === 'departments' && ['insert', 'upsert'].includes(q.op) ? { data: null, error: { message: 'harness: refused' } } : undefined));
  await run(() => h.domain('labour').addDepartment({ name: 'Harness PWD' }));
  await h.settle(60);
  const accUp = h.calls.find((q) => q.table === 'accounts' && q.op === 'upsert');
  const accId = accUp && [].concat(accUp.payload)[0]?.id;
  ok(!h.domain('labour').departments.some((x) => x.name === 'Harness PWD') && h.ctx().accounts.length === accBefore, 'addDepartment refused: neither the department nor its new sub-ledger stays on screen');
  ok(h.destructive().length === 1 && !h.destructive().some((t) => /नहीं मिला|not found/i.test(String(t.title))), `addDepartment refused: exactly one destructive toast — no "account not found" (got ${h.destructive().map((t) => t.title).join(' / ')})`);
  ok(!!accId && h.calls.some((q) => q.table === 'accounts' && q.op === 'delete' && q.filters.some(([m, col, v]) => m === 'eq' && col === 'id' && v === accId)), 'addDepartment refused: the sub-ledger already written to the cloud is deleted again (no orphan)');
}

console.error = qerr; console.info = qinfo; console.warn = qwarn;
console.log(`Provider contract (domains): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
