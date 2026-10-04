// Readable ledger codes (src/lib/accountCode.ts): UUID-id accounts get accounts.code — the next free
// code in the parent group's range — while the id (what vouchers reference) never changes.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const { accountCode, nextAccountCode, planMissingCodes, isUuidId } = await import(pathToFileURL(resolve(HERE, '../src/lib/accountCode.ts')).href);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} — got ${JSON.stringify(a)}`);

const U = (n) => `0000000${n}-0000-4000-8000-000000000000`.slice(-36).replace(/^.{8}/, String(n).padStart(8, '0'));
const acc = (id, parentId, extra = {}) => ({ id, name: extra.name || id, nameHi: '', type: 'liability', openingBalance: 0, openingBalanceType: 'credit', parentId, ...extra });

ok(isUuidId(U(1)), 'UUID detected');
ok(!isUuidId('2101') && !isUuidId(''), 'template id is not a UUID');

eq(accountCode(acc('2101', '2100')), '2101', 'template id is its own code');
eq(accountCode(acc(U(1), '2100')), '', 'UUID with no code → empty (shown as —)');
eq(accountCode(acc(U(1), '2100', { code: '2112' })), '2112', 'stored code wins');

const chart = [
  acc('2000', undefined, { isGroup: true }), acc('2100', '2000', { isGroup: true }),
  acc('2101', '2100'), acc('2102', '2100'), acc('2103', '2100'),
  acc('2200', '2000', { isGroup: true }),
];
eq(nextAccountCode(chart, '2100', false), '2104', 'ledger under XY00 → first free XY01..XY99');
eq(nextAccountCode([...chart, acc(U(2), '2100', { code: '2104' })], '2100', false), '2105', 'stored codes count as used');
eq(nextAccountCode(chart, '2000', true), '2300', 'group under X000 → next free X100 step');
eq(nextAccountCode(chart, '2000', false), '2001', 'ledger directly under X000 → X001');
eq(nextAccountCode(chart, undefined, false), undefined, 'no parent and no type → no code');
eq(nextAccountCode(chart, undefined, false, 'liability'), '2001', 'parentless liability → liability root range (2001…)');
eq(nextAccountCode(chart, '', false, 'expense'), '5001', 'empty parentId treated as parentless');
const crowded = [...chart, ...Array.from({ length: 99 }, (_, i) => acc(String(2001 + i).padStart(4, '0'), undefined)), ...Array.from({ length: 150 }, (_, i) => acc(U(100 + i), undefined, { code: `2000-${String(i + 1).padStart(2, '0')}` }))];
eq(nextAccountCode(crowded, undefined, false, 'liability'), '2000-151', 'suffix range is unbounded (300 party ledgers fit)');
eq(nextAccountCode(chart, U(9), false), undefined, 'unknown UUID parent and no type → no code');
eq(nextAccountCode(chart, U(9), false, 'asset'), '3001', 'orphan (deleted UUID parent) → type root range');

const full = [acc('5100', undefined, { isGroup: true }), ...Array.from({ length: 99 }, (_, i) => acc(String(5101 + i), '5100'))];
eq(nextAccountCode(full, '5100', false), '5100-01', 'full numeric range → suffix form');

const userGroup = acc(U(3), '2100', { isGroup: true, code: '2104' });
eq(nextAccountCode([...chart, userGroup], U(3), false), '2104-01', 'child of a non-XY00 coded group → suffix form');

// planMissingCodes: parents before children, siblings by name, only UUIDs without codes.
const g = acc(U(4), '2000', { isGroup: true, name: 'Zeta group' });
const child = acc(U(5), U(4), { name: 'child' });
const b = acc(U(6), '2100', { name: 'Bravo' });
const a = acc(U(7), '2100', { name: 'Alpha' });
const already = acc(U(8), '2100', { name: 'Has code', code: '2150' });
const plan = planMissingCodes([...chart, child, g, b, a, already]);
eq(plan.get(g.id), '2300', 'new group coded');
eq(plan.get(child.id), '2301', 'its child derives from the group code in the same pass');
eq([plan.get(a.id), plan.get(b.id)], ['2104', '2105'], 'siblings coded in name order');
ok(!plan.has(already.id) && !plan.has('2101'), 'accounts with a code / template ids untouched');
eq(new Set(plan.values()).size, plan.size, 'planned codes are unique');
eq(planMissingCodes(chart).size, 0, 'nothing to do on a template-only chart');
const parties = Array.from({ length: 300 }, (_, i) => acc(U(1000 + i), undefined, { name: `Party ${String(i).padStart(3, '0')}` }));
const pp = planMissingCodes([...chart, ...parties]);
eq(pp.size, 300, 'all 300 parentless party ledgers get a code');
eq(new Set(pp.values()).size, 300, '…all unique');
eq([pp.get(parties[0].id), pp.get(parties[99].id)], ['2001', '2000-01'], 'root range first, then suffix form');

console.log(`Account codes: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
