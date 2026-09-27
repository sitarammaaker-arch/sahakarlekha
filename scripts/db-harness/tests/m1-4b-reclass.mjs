#!/usr/bin/env node
// M1-4b · migration 075 (persist the 4406 / 4407 reclassification) against the restored backup.
//
// Needs a running harness that 072 / 075 have NOT been applied to. Proves: exactly the diverged
// rows change and only in classification; openings, vouchers, voucher_entries, ledger_events and
// every other account are byte-identical; the opening-balance guard aborts with nothing changed;
// re-running is a no-op; the down restores the exact previous rows.
//
// Run: node scripts/db-harness/tests/m1-4b-reclass.mjs

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { inRollback, harnessClient } from '../lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIG = (f) => pathResolve(HERE, '../../..', 'supabase/migrations', f);
const apply = (...files) => execFileSync(process.execPath, [pathResolve(HERE, '../harness.mjs'), 'apply', ...files.map(MIG)], { stdio: 'pipe' });
const tryApply = (...files) => { try { apply(...files); return { ok: true }; } catch (e) { return { ok: false, err: String(e.stderr || e.message) }; } };

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};

const TARGET = `
  (a.id = '4407' and (a.type, a."parentId", a.subtype, a."openingBalanceType", a."isSystem") is distinct from ('income', '4400', 'other_income', 'credit', false))
  or (a.id = '4406' and (a.type, a."parentId", a.subtype, a."openingBalanceType") is distinct from ('equity', '1200', 'reserve', 'debit'))`;

const snap = () => inRollback(async (tx) => {
  const one = async (sql) => (await tx.query(sql)).rows[0].h;
  return {
    vouchers: await one(`select md5(string_agg(to_jsonb(v)::text, '|' order by v.society_id, v.id)) as h from public.vouchers v`),
    entries: await one(`select md5(string_agg(to_jsonb(e)::text, '|' order by e.id)) as h from public.voucher_entries e`),
    events: await one(`select md5(string_agg(to_jsonb(e)::text, '|' order by e.event_id)) as h from public.ledger_events e`),
    otherAccounts: await one(`select md5(string_agg(to_jsonb(a)::text, '|' order by a.society_id, a.id)) as h from public.accounts a where a.id not in ('4406', '4407')`),
    rows4406_4407: await one(`select md5(string_agg(to_jsonb(a)::text, '|' order by a.society_id, a.id)) as h from public.accounts a where a.id in ('4406', '4407')`),
    openings: await one(`select md5(string_agg(a.society_id || a.id || coalesce(a."openingBalance"::text, 'null'), '|' order by a.society_id, a.id)) as h from public.accounts a where a.id in ('4406', '4407')`),
    nAccounts: (await tx.query('select count(*)::int as n from public.accounts')).rows[0].n,
    targets: (await tx.query(`select a.society_id, a.id, to_jsonb(a) as row from public.accounts a where ${TARGET} order by 1, 2`)).rows,
  };
});

const pre = (await inRollback((tx) => tx.query("select to_regclass('public.app_migrations') as am, to_regclass('public.account_reclass_log') as rl"))).rows[0];
if (pre.am || pre.rl) throw new Error('m1-4b: 072/075 already applied — bring the harness down and up again');

const before = await snap();
console.log(`Before: ${before.targets.length} diverged rows (${before.targets.filter((t) => t.id === '4407').length} × 4407, ${before.targets.filter((t) => t.id === '4406').length} × 4406)`);
ok('the backup has diverged 4406/4407 rows to fix', before.targets.length > 0);

console.log('Apply 072 + 075');
apply('072_app_migrations.sql', '075_reclass_4406_4407.sql');
const after = await snap();
await inRollback(async (tx) => {
  ok('no 4406/4407 row differs from the app definition any more', after.targets.length === 0, `${after.targets.length} left`);
  const bad4407 = (await tx.query(`select count(*)::int as n from public.accounts where id = '4407' and not (type = 'income' and "parentId" = '4400' and subtype = 'other_income' and "openingBalanceType" = 'credit' and "isSystem" = false)`)).rows[0].n;
  const bad4406 = (await tx.query(`select count(*)::int as n from public.accounts where id = '4406' and not (type = 'equity' and "parentId" = '1200' and subtype = 'reserve' and "openingBalanceType" = 'debit')`)).rows[0].n;
  ok('every 4407 is income / 4400 / other_income / credit', bad4407 === 0);
  ok('every 4406 is equity / 1200 / reserve / debit', bad4406 === 0);
  const log = (await tx.query("select society_id, account_id, old_row from public.account_reclass_log where migration = '075' order by 1, 2")).rows;
  ok(`the log holds exactly the ${before.targets.length} changed rows`, log.length === before.targets.length
    && log.every((l, i) => l.society_id === before.targets[i].society_id && l.account_id === before.targets[i].id));
  ok("the log's old_row is the row exactly as it was", log.every((l, i) => JSON.stringify(l.old_row) === JSON.stringify(before.targets[i].row)));
  ok("app_migrations records '075'", (await tx.query("select 1 from public.app_migrations where version = '075'")).rowCount === 1);
});

console.log('Nothing but classification changed');
ok('vouchers byte-identical', before.vouchers === after.vouchers);
ok('voucher_entries byte-identical', before.entries === after.entries);
ok('ledger_events byte-identical', before.events === after.events);
ok('every other account byte-identical', before.otherAccounts === after.otherAccounts);
ok('4406/4407 opening balances unchanged', before.openings === after.openings);
ok('account count unchanged', before.nAccounts === after.nAccounts);

console.log('Idempotency');
apply('075_reclass_4406_4407.sql');
const nLog = (await inRollback((tx) => tx.query("select count(*)::int as n from public.account_reclass_log where migration = '075'"))).rows[0].n;
ok('re-running 075 logs and changes nothing more', nLog === before.targets.length && (await snap()).rows4406_4407 === after.rows4406_4407);

console.log('Down');
apply('075_reclass_4406_4407_down.sql');
const down = await snap();
ok('4406/4407 rows are exactly as before 075', down.rows4406_4407 === before.rows4406_4407);
ok('the down removed the log (table dropped when empty) and the 075 record', (await inRollback((tx) => tx.query(
  "select to_regclass('public.account_reclass_log') is null as gone, not exists (select 1 from public.app_migrations where version = '075') as unrecorded"))).rows[0].gone === true);

console.log('Opening-balance guard');
const c = harnessClient(); await c.connect();
const victim = before.targets[0];
await c.query('update public.accounts set "openingBalance" = 100 where society_id = $1 and id = $2', [victim.society_id, victim.id]);
await c.end();
const guarded = tryApply('075_reclass_4406_4407.sql');
ok('075 aborts when a row to change has an opening balance', !guarded.ok && /non-zero opening balance/.test(guarded.err), guarded.ok ? 'applied' : '');
const g = await snap();
ok('… and changed nothing (same diverged rows, no log table)', g.targets.length === before.targets.length
  && (await inRollback((tx) => tx.query("select to_regclass('public.account_reclass_log') as rl"))).rows[0].rl === null);
const c2 = harnessClient(); await c2.connect();
await c2.query('update public.accounts set "openingBalance" = $3 where society_id = $1 and id = $2', [victim.society_id, victim.id, victim.row.openingBalance]);
await c2.end();
ok('restored the probe row', (await snap()).rows4406_4407 === before.rows4406_4407);

apply('072_app_migrations_down.sql');
console.log(`\nM1-4b reclass: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
