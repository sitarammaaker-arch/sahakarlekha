#!/usr/bin/env node
// M1-4c · which proposals are seeded and the seed SQL's safety shape. CI-safe (no DB).
// Run: node scripts/test-m1-4c-seed-roles.mjs

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const { selectSeeds, buildSeedSql, buildSeedUndoSql, SEEDED_BY } = await import(pathToFileURL(pathResolve(HERE, 'm1-4c-seed-roles.mjs')).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};

const p = (role, basis, accountId = null, idCollision = null) => ({ role, basis, accountId, accountName: accountId ? `acc ${accountId}` : null, idCollision });
const societies = [
  { societyId: 'S1', societyName: "Ram's Society", societyType: 'marketing_processing', proposals: [
    p('cash', 'matched', '3301'), p('supplier.payable', 'preferred_id', '2101'), p('sales.default', 'ambiguous'),
    p('customer.receivable', 'missing', null, { id: '3303', name: 'KCC' }), p('gst.output.cgst', 'missing')] },
  { societyId: 'GHOST', societyName: 'SOC001', societyType: null, proposals: [p('cash', 'matched', '3301')] },
];
const { seeds, skipped } = selectSeeds(societies);
ok('seeds only matched and preferred_id', seeds.map((s) => s.role).join(',') === 'cash,supplier.payable');
ok('ambiguous / missing / collision are left out with their reason', skipped.some((x) => x.role === 'sales.default' && x.reason === 'ambiguous')
  && skipped.some((x) => x.role === 'customer.receivable' && /id 3303 is "KCC"/.test(x.reason)) && skipped.some((x) => x.role === 'gst.output.cgst'));
ok('a society without settings (ghost) is skipped entirely', !seeds.some((s) => s.societyId === 'GHOST') && skipped.some((x) => x.society === 'SOC001' && /ghost/.test(x.reason)));

console.log('Seed SQL');
const sql = buildSeedSql({ runAt: 'x', seeds });
const pos = (s) => sql.indexOf(s);
ok('one transaction', /\nbegin;\n[\s\S]*\ncommit;\n$/.test(sql));
ok('refuses if any seeded society already has roles, before inserting', pos('already exist') > 0 && pos('already exist') < pos('insert into public.account_roles'));
ok('every row is stamped updated_by = seed (M1-4c)', (sql.match(new RegExp(`'${SEEDED_BY.replace(/[()]/g, '\\$&')}'\\)`, 'g')) || []).length === 2);
ok('post-check on the seeded count', /if n <> 2 then raise exception/.test(sql));
ok('never updates or deletes', !/\bupdate\s+public\.|\bdelete\s+from\b/i.test(sql));
ok('undo removes only seeded rows', /delete from public\.account_roles where updated_by = 'seed \(M1-4c\)';/.test(buildSeedUndoSql({ runAt: 'x' })));

console.log(`\nM1-4c seed roles: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
