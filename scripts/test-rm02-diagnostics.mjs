#!/usr/bin/env node
// RM-02 · the per-society diagnostic must stay READ-ONLY.
//
// Checks the shipped SQL (scripts/rm02/diagnostics.sql) passes the runner's read-only guard, that
// the guard refuses every write shape (and is not fooled by keywords inside comments/strings), and
// that the report still carries every column the Phase-3 S1+ migrations rely on.
//
// Run: node scripts/test-rm02-diagnostics.mjs

import { readFileSync } from 'node:fs';
import { assertReadOnlySql, sqlCode, wrapReadOnly, SQL_PATH } from './rm02-diagnostics.mjs';

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };
const refuses = (sql) => { try { assertReadOnlySql(sql); return false; } catch { return true; } };

const SQL = readFileSync(SQL_PATH, 'utf8');

console.log('Shipped SQL');
let returned = '';
ok('diagnostics.sql passes the read-only guard', (() => { try { returned = assertReadOnlySql(SQL); return true; } catch (e) { console.log('    ', e.message); return false; } })());
ok('guard returns the query with its comments stripped', returned.length > 0 && !returned.includes('--'));
ok('guard keeps string literals intact (sent SQL is the real query)', returned.includes("'voucher.posted'") && returned.includes("'1102'"));
ok('wrapped in a read-only transaction that rolls back', /^begin transaction read only; [\s\S]+; rollback;$/.test(wrapReadOnly(returned)));

console.log('Guard refuses writes');
ok('refuses INSERT', refuses('insert into vouchers values (1)'));
ok('refuses UPDATE inside a CTE', refuses('with x as (update accounts set name = 1 returning *) select * from x'));
ok('refuses DELETE inside a CTE', refuses('with x as (delete from vouchers returning *) select 1'));
ok('refuses a second statement', refuses('select 1; select 2'));
ok('refuses DDL', refuses('select 1 from t where 1 = (select 1) union select 1 from pg_class; drop table t'));
ok('refuses leading non-SELECT', refuses('truncate vouchers'));
ok('refuses set/reset (session changes)', refuses('select set_config(1) from t where x = 1 and set = 1'));
ok('refuses COPY', refuses('copy vouchers to stdout'));

console.log('Guard is not fooled by comments or strings');
ok('keyword in a -- comment is ignored', !refuses('select 1 -- delete everything\n from t'));
ok('keyword in a /* */ comment is ignored', !refuses('select /* update */ 1'));
ok("keyword in a 'string' is ignored", !refuses("select 1 from t where narration like 'Delete % update'"));
ok('comment/string stripping removes the text', !/delete/i.test(sqlCode("select 'delete' -- delete\n")));

console.log('Report shape');
const COLUMNS = [
  'society_id', 'society_name', 'society_type',
  'fy_label', 'fy_label_valid', 'fy_start_raw', 'fy_start_is_date', 'fy_prev_label', 'fy_prev_equals_current',
  'period_lock_date', 'fy_locked',
  'vouchers_live', 'vouchers_deleted', 'vouchers_outside_fy', 'vouchers_before_2000', 'vouchers_bad_date',
  'auto_member_vouchers', 'auto_member_members', 'auto_member_dup_member_kinds', 'auto_member_with_other_posting',
  'unbalanced_vouchers', 'orphan_leg_vouchers',
  'live_without_posting', 'cancelled_with_live_posting', 'posting_without_voucher',
  'entries_orphan', 'entries_of_deleted_vouchers',
  'sales_without_voucher', 'purchases_without_voucher',
  'dup_account_groups', 'dup_account_extra_rows',
  'share_register', 'gl_share_capital', 'acc_1102_name',
];
const finalSelect = returned.slice(returned.lastIndexOf('\nselect '));
for (const c of COLUMNS) ok(`final SELECT exposes ${c}`, new RegExp(`\\b${c}\\b`).test(finalSelect));
ok('soft-deleted vouchers are excluded from legs (RULE 5)', /where not v\.is_deleted/.test(returned));
ok('society_id compared as text (mixed uuid/text columns)', (returned.match(/society_id::text/g) || []).length >= 8);

console.log(`\nRM-02 diagnostics: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
