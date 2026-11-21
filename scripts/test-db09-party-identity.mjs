// DB-09 (product audit 2026-11-17) — PAN / Aadhaar / bank details of customers, suppliers, farmers, employees and workers
// live in party_identity (migration 195, role-scoped RLS; 196 blanks the legacy columns). PGlite: scratchpad t195.mjs.
// Part 1: the pure lib. Part 2: the REAL DataProvider (scripts/lib/provider-harness.mjs) as an admin and as a cashier.
// Run: node scripts/test-db09-party-identity.mjs
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { pathToFileURL } from 'node:url';
  import { resolve as r } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('./') && ctx.parentURL && ctx.parentURL.includes('/src/lib/')) { const u = new URL(spec + '.ts', ctx.parentURL); if (existsSync(u)) return { url: u.href, shortCircuit: true }; }
    if (spec.startsWith('@/')) { const b = r(SRC, spec.slice(2)); for (const c of [b + '.ts', b + '.tsx']) if (existsSync(c)) return { url: pathToFileURL(c).href, shortCircuit: true }; }
    return next(spec, ctx);
  }
`));
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };

// ── Part 1: lib ──
const P = await import(pathToFileURL(resolve(SRC, 'lib/partyIdentity.ts')).href);
{
  ok(P.canReadPartyPii('accountant', 'customer') && !P.canReadPartyPii('cashier', 'customer') && !P.canReadPartyPii(undefined, 'employee'), 'the five PII roles read; cashier / no role do not');
  ok(P.canReadPartyPii('procurementOfficer', 'farmer') && !P.canReadPartyPii('procurementOfficer', 'customer'), 'a procurementOfficer reads farmers\' bank details only');
  const cust = { id: 'c1', name: 'Shop', pan: 'AAAPA1234A', bankName: 'SBI', accountNo: '123', ifsc: 'SBIN0001234', gstin: '06AAAPA1234A1Z5' };
  const stripped = P.stripPartyPII(cust, 'customer');
  ok(!('pan' in stripped) && !('accountNo' in stripped) && stripped.gstin === cust.gstin && stripped.name === 'Shop', 'strip removes PAN / bank but keeps GSTIN and the rest');
  ok(JSON.stringify(P.pickPartyPII({ pan: ' X ', ifsc: '' }, 'customer')) === '{"pan":"X"}', 'pick trims and drops empties');
  const legacy = [{ id: 'c1', pan: 'OLD' }, { id: 'c2', pan: 'KEEP' }];
  const idRows = [{ entity_type: 'customer', entity_id: 'c1', fields: {} }, { entity_type: 'supplier', entity_id: 'c2', fields: { pan: 'NOPE' } }];
  const ov = P.applyPartyIdentity(legacy, idRows, 'customer', true);
  ok(!('pan' in ov[0]) && ov[1].pan === 'KEEP', 'an identity row is authoritative (a cleared PAN stays cleared); no row → the legacy value; other types ignored');
  ok(P.applyPartyIdentity([{ id: 'c1', pan: 'X' }], [], 'customer', false).every((r) => !('pan' in r)), 'a role that may not read PII gets it stripped');
  const row = P.partyIdentityRowFor('S1', 'employee', 'e1', { pan: '', bankAccount: '99' });
  ok(row.entity_type === 'employee' && JSON.stringify(row.fields) === '{"bankAccount":"99"}' && P.partyIdentityRowFor('S1', 'worker', 'w1', {}).fields && Object.keys(P.partyIdentityRowFor('S1', 'worker', 'w1', {}).fields).length === 0, 'the upsert row carries only non-empty fields; an all-empty row records "cleared"');
  ok(P.partyPIIChanged({ pan: 'A' }, { pan: 'A', name: 'x' }, 'customer') === false && P.partyPIIChanged({ pan: 'A' }, { pan: 'B' }, 'customer'), 'changed = a PII field changed (other fields do not count)');
  const m195 = read('supabase/migrations/195_party_identity.sql');
  for (const [t, fields] of Object.entries(P.PARTY_PII_FIELDS)) ok(fields.every((f) => m195.includes(`'${f}'`)), `195 copies every ${t} field the app uses (${fields.join(', ')})`);
}

// ── Part 2: the real provider ──
const { mountDataProvider } = await import('./lib/provider-harness.mjs');
const qerr = console.error; console.error = () => {}; const qwarn = console.warn; console.warn = () => {};
const S = 'SOC-H';
const seed = {
  customers: [{ id: 'c1', customerCode: 'C1', name: 'Shop', pan: 'LEGACYPAN', society_id: S }],
  employees: [{ id: 'e1', empNo: 'E1', name: 'Clerk', pan: 'LEGACY', bankAccount: 'LEGACYAC', status: 'active', society_id: S }],
  party_identity: [{ society_id: S, entity_type: 'customer', entity_id: 'c1', fields: { pan: 'AAAPA1234A', accountNo: '555' } }, { society_id: S, entity_type: 'employee', entity_id: 'e1', fields: { pan: 'DDDPD1234D', bankAccount: '777' } }],
};
{
  const h = await mountDataProvider({ seed });
  const c = () => h.ctx();
  const run = async (fn) => { await h.act(async () => { fn(); }); await h.settle(); };
  ok(c().customers[0].pan === 'AAAPA1234A' && c().customers[0].accountNo === '555' && c().employees[0].bankAccount === '777', 'admin: PAN / bank come from party_identity (the legacy column is not shown)');

  h.reset();
  await run(() => c().updateEmployee('e1', { pan: 'NEWPAN1234N' }));
  const emp = h.calls.filter((q) => q.table === 'employees' && q.op !== 'select');
  const pi = h.calls.filter((q) => q.table === 'party_identity' && q.op === 'upsert');
  ok(emp.every((q) => !JSON.stringify(q.payload).includes('NEWPAN')), 'admin edit: the employees row never carries the PAN');
  ok(pi.length === 1 && pi[0].payload.entity_type === 'employee' && pi[0].payload.fields.pan === 'NEWPAN1234N' && pi[0].payload.fields.bankAccount === '777', 'admin edit: party_identity gets the full PII set (PAN changed, bank kept)');

  h.reset(); h.respond((q) => (q.table === 'party_identity' && q.op === 'upsert' ? { data: null, error: { message: 'refused' } } : undefined));
  await run(() => c().updateEmployee('e1', { pan: 'BADPAN1234B' }));
  ok(c().employees[0].pan === 'NEWPAN1234N' && h.destructive().length === 1, 'party_identity refused → the PAN on screen goes back + one destructive toast (the rest of the edit stays)');

  h.reset();
  await run(() => c().updateEmployee('e1', { name: 'Senior Clerk' }));
  ok(h.calls.filter((q) => q.table === 'party_identity' && q.op !== 'select').length === 0, 'an edit that does not touch PII writes nothing to party_identity');

  h.reset();
  await run(() => c().addCustomer({ name: 'New Co', pan: 'EEEPE1234E', bankName: 'PNB' }));
  const cRows = h.calls.filter((q) => q.table === 'customers' && q.op !== 'select');
  const cId = h.calls.find((q) => q.table === 'party_identity' && q.op === 'upsert');
  ok(cRows.length >= 1 && cRows.every((q) => !JSON.stringify(q.payload).includes('EEEPE1234E') && !JSON.stringify(q.payload).includes('"bankName"')), 'admin add customer: neither the base row nor the extras patch carries PAN / bank');
  ok(cId && cId.payload.entity_type === 'customer' && cId.payload.fields.pan === 'EEEPE1234E' && cId.payload.fields.bankName === 'PNB', 'admin add customer: PAN / bank go to party_identity');
}
{
  const h = await mountDataProvider({ seed, user: { id: 'u2', name: 'Cashier', email: 'cash@harness.test', role: 'cashier', societyId: S } });
  const c = () => h.ctx();
  const run = async (fn) => { await h.act(async () => { fn(); }); await h.settle(); };
  ok(!('pan' in c().customers[0]) && !('bankAccount' in c().employees[0]) && !('pan' in c().employees[0]), 'cashier: PAN / bank are not on screen at all (not even the legacy value)');
  h.reset();
  await run(() => c().updateEmployee('e1', { pan: 'CASHPAN12C' }));
  ok(h.calls.filter((q) => q.table === 'party_identity' && q.op !== 'select').length === 0 && c().employees[0].pan === undefined && h.destructive().length === 1, 'cashier typing a PAN: nothing is written, the PAN leaves the screen, one destructive toast says why');
  ok(h.calls.filter((q) => q.table === 'employees' && q.op !== 'select').every((q) => !JSON.stringify(q.payload).includes('CASHPAN')), 'cashier: the employees row never carries it either');
}
console.error = qerr; console.warn = qwarn;

// ── Part 3: wiring that the provider test does not reach ──
{
  const dc = read('src/contexts/DataContext.tsx');
  ok(dc.includes("persistPartyIdentity('supplier', s.id, s, opts.before") && dc.includes("persistPartyIdentity('customer', c.id, c, opts.before") && (dc.match(/if \(!partySplitRef\.current\) setIf\('pan', pan\);/g) || []).length === 2, 'suppliers and customers: PAN / bank leave the extras patch in SPLIT mode and go to party_identity');
  ok(dc.includes("if (split) persistPartyIdentity('farmer', f.id, f, before,") && dc.includes("persistFarmerExtras(next, true, before)"), 'farmers: bank details go to party_identity, not the farmer row');
  ok(dc.includes("overlayParty(data as unknown as Farmer[], 'farmer')") && dc.includes("setSuppliersState(overlayParty(supData || [], 'supplier'))"), 'load overlays farmers and suppliers too');
  const lab = read('src/contexts/LabourDataContext.tsx');
  ok(lab.includes("stripPartyPII(w, 'worker')") && lab.includes("persistWorkerIdentity(updated, old,") && lab.includes("applyPartyIdentity(rows, pRes.data, 'worker'"), 'workers (Labour provider): same split');
  const run = read('src/lib/export/run.ts');
  ok(run.includes("const PARTY_TYPE_OF_ENTITY: Record<string, PartyType> = { customer: 'customer', supplier: 'supplier', procurement_farmer: 'farmer', employee: 'employee', worker: 'worker' };") && run.includes('applyPartyIdentity(rows as { id: string }[]'), 'exports overlay party_identity (or strip it for a role without access)');
  ok(read('src/lib/export/entities/trade.ts').includes("key: 'party_identity',") && read('src/lib/export/entities/trade.ts').includes("backupPolicy: 'full',\n  optionalTable: true,"), 'party_identity is in every backup (optional table before 195)');
  const m = read('supabase/migrations/195_party_identity.sql');
  ok(m.includes("insert into public.restore_tables (table_name) values ('party_identity')") && m.includes('grant select, insert, update, delete on public.party_identity to authenticated;') && m.includes('revoke all on public.party_identity from public, anon;'), '195: restorable, explicit grants, nothing for anon');
  ok(m.includes("or (p_entity_type = 'farmer' and coalesce(auth.jwt() ->> 'user_role', '') = 'procurementOfficer')"), '195: the procurementOfficer exception is farmers only');
  const b = read('supabase/migrations/196_party_pii_blank.sql');
  ok((b.match(/on conflict \(society_id, entity_type, entity_id\) do nothing;/g) || []).length === 5 && !b.includes('do update set fields'), '196: an existing party_identity row is authoritative (a cleared PAN never comes back from the legacy column)');
}

console.log(`DB-09 party identity: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
