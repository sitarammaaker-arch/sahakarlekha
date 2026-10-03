#!/usr/bin/env node
// M1-4b · static guard on migration 075 (persist the 4406 / 4407 reclassification). CI-safe.
// Behaviour against a restored backup: scripts/db-harness/tests/m1-4b-reclass.mjs.
//
// Pins: it may change ONLY accounts 4406/4407 and only classification columns; it matches the
// app's ACCOUNT_PATCHES exactly; it guards on opening balances; it logs before changing; its down
// restores from that log.
//
// Run: node scripts/test-m1-4b-reclass.mjs

import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
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
const { migrateAccounts } = await import(pathToFileURL(pathResolve(HERE, '../src/lib/storage.ts')).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};

const raw = readFileSync(pathResolve(HERE, '../supabase/migrations/075_reclass_4406_4407.sql'), 'utf8');
const code = raw.replace(/--[^\n]*/g, ' ');
const lower = code.toLowerCase();
const downRaw = readFileSync(pathResolve(HERE, '../supabase/migrations/075_reclass_4406_4407_down.sql'), 'utf8');

console.log('Scope');
ok('wrapped in begin … commit', /^\s*begin;[\s\S]*commit;\s*$/.test(lower));
const updates = [...code.matchAll(/update\s+public\.(\w+)[\s\S]*?;/gi)].map((m) => m[0]);
ok('exactly two UPDATEs, both on accounts', updates.length === 2 && updates.every((u) => /update\s+public\.accounts\b/i.test(u)));
ok("one UPDATE is limited to id '4407', the other to '4406'", /a\.id = '4407'/.test(updates[0] || '') && /a\.id = '4406'/.test(updates[1] || ''));
ok('both UPDATEs are limited to the logged target rows', updates.every((u) => /from m075_targets t/.test(u)));
const setCols = updates.flatMap((u) => [...u.slice(u.indexOf(' set ') >= 0 ? u.indexOf(' set ') : u.toLowerCase().indexOf('set')).matchAll(/"?([a-zA-Z]+)"?\s*=/g)].map((m) => m[1]))
  .filter((c) => !['id', 'society_id'].includes(c));
const allowed = ['type', 'parentId', 'subtype', 'openingBalanceType', 'isSystem', 'name', 'nameHi'];
ok('SET touches only classification / label columns (never openingBalance)', setCols.every((c) => allowed.includes(c)) && !setCols.includes('openingBalance'), setCols.join(','));
ok('no DELETE / TRUNCATE / DROP / ALTER of an existing table', !/\bdelete\s+from\b|\btruncate\b|\bdrop\s+table\b/.test(lower)
  && [...lower.matchAll(/alter\s+table\s+public\.(\w+)/g)].every((m) => m[1] === 'account_reclass_log'));
ok('no voucher / entries / ledger_events statement', !/\b(vouchers|voucher_entries|ledger_events)\b/.test(lower));

console.log('Safety');
ok('aborts on a non-zero opening balance before anything is changed',
  lower.indexOf('raise exception') > 0 && lower.indexOf('raise exception') < lower.indexOf('insert into public.account_reclass_log')
  && lower.indexOf('insert into public.account_reclass_log') < lower.indexOf('update public.accounts') && /"openingbalance", 0\) <> 0/.test(lower));
ok('logs the full previous row (to_jsonb) before updating', /to_jsonb\(a\)/.test(code));
ok('log table: RLS on, nothing granted to anon/authenticated', /enable row level security/.test(lower) && /revoke all on public\.account_reclass_log from anon, authenticated/.test(lower));
ok("records '075' as the last statement", /values \('075', 'reclass_4406_4407'\)\s*on conflict \(version\) do nothing;\s*commit;\s*$/.test(raw));
ok('down restores every classification column from the log', ['type', 'parentId', 'subtype', 'openingBalanceType', 'isSystem', 'name', 'nameHi'].every((c) => new RegExp(`"?${c}"?\\s*= \\(?l\\.old_row->>'${c}'`).test(downRaw)));
ok('down drops the log only when empty, and forgets 075', /if not exists \(select 1 from public\.account_reclass_log\)/.test(downRaw) && /version = '075'/.test(downRaw));

console.log("Matches the app's in-memory patch (ACCOUNT_PATCHES via migrateAccounts)");
const stale = [
  { id: '4407', name: 'Admission Fee', nameHi: 'प्रवेश शुल्क', type: 'equity', openingBalance: 0, openingBalanceType: 'credit', isSystem: true, isGroup: false, parentId: '1200', subtype: 'reserve' },
  { id: '4406', name: 'Patronage Rebate', nameHi: 'संरक्षण छूट', type: 'expense', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '5400', subtype: 'other_income' },
];
const patched = migrateAccounts(stale).accounts;
const p4407 = patched.find((a) => a.id === '4407');
const p4406 = patched.find((a) => a.id === '4406');
const u4407 = updates[0] || '';
const u4406 = updates[1] || '';
const setOf = (u, col) => (u.match(new RegExp(`"?${col}"?\\s*=\\s*'([^']*)'`)) || [])[1];
for (const [col, val] of [['type', p4407.type], ['parentId', p4407.parentId], ['subtype', p4407.subtype], ['openingBalanceType', p4407.openingBalanceType], ['name', p4407.name], ['nameHi', p4407.nameHi]]) {
  ok(`4407 ${col} = app's '${val}'`, setOf(u4407, col) === val, setOf(u4407, col));
}
ok("4407 isSystem = app's false", p4407.isSystem === false && /"isSystem" = false/.test(u4407));
for (const [col, val] of [['type', p4406.type], ['parentId', p4406.parentId], ['subtype', p4406.subtype], ['openingBalanceType', p4406.openingBalanceType], ['name', p4406.name], ['nameHi', p4406.nameHi]]) {
  ok(`4406 ${col} = app's '${val}'`, setOf(u4406, col) === val, setOf(u4406, col));
}

console.log(`\nM1-4b static: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
