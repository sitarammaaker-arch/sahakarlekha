#!/usr/bin/env node
// B2 · posting-flag-batch (pure parts). The end-to-end run is on the db-harness (see the PR).
// Run: node scripts/test-posting-flag-batch.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
const { selectTargets, buildFlagSql, buildFlagUndoSql, FIX } = await import(pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), 'posting-flag-batch.mjs')).href);
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };
const base = { flag: false, has_settings: true, fy_locked: false, open_fy_end: '2027-03-31', live_vouchers: 5, last_date: '2026-09-01', journal_accounts: 0, entries_accounts: 0 };
const rows = [
  { ...base, sid: 'ready' }, { ...base, sid: 'empty', live_vouchers: 0 }, { ...base, sid: 'on', flag: true },
  { ...base, sid: 'heal', entries_accounts: 1 }, { ...base, sid: 'wait', open_fy_end: '2026-03-31', last_date: null }, { ...base, sid: 'blocked', open_fy_end: null },
];
ok('only READY and EMPTY societies are switched on', selectTargets(rows, '2026-10-01').join() === 'ready,empty');
const sql = buildFlagSql({ targets: ['ready', 'empty'], runAt: 't', actor: "B2 'batch'" });
ok('one transaction', /\nbegin;[\s\S]*\ncommit;\n$/.test(sql));
ok('refuses a second apply', sql.includes(`where fix = '${FIX}'`) && sql.includes('already applied'));
ok('re-checks readiness inside the transaction before writing', sql.indexOf('no longer ready') > 0 && sql.indexOf('no longer ready') < sql.indexOf('insert into public.society_flags'));
ok('logs the prior flags row (or its absence) before writing', sql.indexOf("'society_flags'") < sql.indexOf('insert into public.society_flags') && sql.includes("jsonb_build_object('absent', true)"));
ok('post-check counts the flags that are on', /post-check % of 2 on/.test(sql));
ok("quotes are escaped", sql.includes("'B2 ''batch'''"));
ok('touches only society_flags (and the log)', !/\b(update|delete from|insert into) public\.(vouchers|voucher_entries|ledger_events|voucher_lines)\b/.test(sql));
const undo = buildFlagUndoSql({ runAt: 't' });
ok('undo deletes rows that did not exist and restores the rest from the log', /old_row \? 'absent'/.test(undo) && /not \(l\.old_row \? 'absent'\)/.test(undo) && /delete from public\.data_fix_log where fix/.test(undo));
console.log(`\nposting-flag-batch: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
