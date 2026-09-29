#!/usr/bin/env node
// S3-d-3 · unit tests of scripts/heal-voucher-consistency.mjs (pure planner + SQL builders). CI-safe.
// The real run (plan → apply → re-plan finds nothing → re-apply refused → undo restores) is done on the
// db-harness with a restored backup before any production apply.
//
// Run: node scripts/test-heal-voucher-consistency.mjs

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const { planConsistency, buildConsistencySql, buildConsistencyUndoSql, currentPosting, FIX } =
  await import(pathToFileURL(pathResolve(HERE, 'heal-voucher-consistency.mjs')).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};
const AT = '2026-09-29T00:00:00.000Z';
const V = (over) => ({ id: 'v', society_id: 'S', voucherNo: 'RV/1', type: 'receipt', date: '2026-08-22', debitAccountId: '3301', creditAccountId: '1102',
  amount: 250, narration: 'n', createdAt: '2026-08-22T02:48:03.815', createdBy: 'u', isDeleted: false, lines: null, ...over });
const ent = (vid, id, acc, dr, cr) => ({ id: `${vid}-${id}`, voucherId: vid, accountId: acc, dr, cr, society_id: 'S' });
const posted = (vid, lines, seq = 1, extra = {}) => ({ aggregate_id: vid, event_id: `e-${vid}-${seq}`, event_type: 'voucher.posted', sequence: seq,
  payload: { lines, createdAt: '2026-08-22T02:48:03.815Z', ...extra } });
const L = (acc, drCr, m) => ({ accountId: acc, drCr, amountMinor: m });
const plan = (vs, ents, evs) => planConsistency(vs, new Map(Object.entries(ents)), new Map(Object.entries(evs)), AT).actions;

console.log('Cancelled vouchers');
let a = plan([V({ id: 'c1', isDeleted: true })], { c1: [ent('c1', 'dr', '3301', 250, 0), ent('c1', 'cr', '1102', 0, 250)] }, {});
ok('cancelled, no journal → delete entries only', a.length === 1 && a[0].kind === 'cancelled-entries' && a[0].deleteEntries.length === 2 && !a[0].insertEntries.length && !a[0].events.length);
a = plan([V({ id: 'c2', isDeleted: true })], { c2: [ent('c2', 'dr', '3301', 250, 0)] }, { c2: [posted('c2', [L('3301', 'Dr', 25000), L('1102', 'Cr', 25000)])] });
ok('cancelled with a live posting → voucher.cancelled flipping THAT posting, seq 2, reversal_of it',
  a[0].kind === 'cancelled-journal' && a[0].events.length === 1 && a[0].events[0].eventType === 'voucher.cancelled' && a[0].events[0].sequence === 2
  && a[0].events[0].reversalOf === 'e-c2-1' && JSON.stringify(a[0].events[0].payload.lines) === JSON.stringify([L('3301', 'Cr', 25000), L('1102', 'Dr', 25000)]));
a = plan([V({ id: 'c3', isDeleted: true })], {}, { c3: [posted('c3', [L('3301', 'Dr', 1)]), { aggregate_id: 'c3', event_id: 'x', event_type: 'voucher.cancelled', sequence: 2, payload: {} }] });
ok('cancelled, already journaled, no entries → nothing', a.length === 0);

console.log('Live vouchers');
a = plan([V({ id: 'l1' })], { l1: [ent('l1', 'l1-dr', '3301', 500, 0), ent('l1', 'l1-cr', '1102', 0, 500)] }, { l1: [posted('l1', [L('3301', 'Dr', 50000), L('1102', 'Cr', 50000)])] });
ok('edit never journaled → entries rebuilt + reversed/reposted to the ROW legs', a[0].kind === 'live-journal+entries' && a[0].deleteEntries.length === 2 && a[0].insertEntries.length === 2
  && a[0].insertEntries.every((e) => e.dr === 250 || e.cr === 250) && a[0].events.map((e) => `${e.eventType}#${e.sequence}`).join() === 'voucher.reversed#2,voucher.reposted#3');
ok('reposted keeps the posting\'s createdAt string; reversed points at the posting', a[0].events[1].payload.createdAt === '2026-08-22T02:48:03.815Z' && a[0].events[0].reversalOf === 'e-l1-1'
  && JSON.stringify(a[0].events[1].payload.lines) === JSON.stringify([L('3301', 'Dr', 25000), L('1102', 'Cr', 25000)]));
// The real ₹0 receipts carry explicit zero lines (as in prod).
const zl = [{ id: 'z1', accountId: '3301', type: 'Dr', amount: 0 }, { id: 'z2', accountId: '1102', type: 'Cr', amount: 0 }];
a = plan([V({ id: 'l2', amount: 0, lines: zl })], { l2: [ent('l2', 'z1', '3301', 250, 0), ent('l2', 'z2', '1102', 0, 250)] }, { l2: [posted('l2', [L('3301', 'Dr', 0), L('1102', 'Cr', 0)])] });
ok('₹0 voucher, journal ₹0, entries ₹250 → entries aligned to the voucher, no journal change', a[0].kind === 'live-entries' && !a[0].events.length && a[0].deleteEntries.length === 2
  && a[0].insertEntries.length === 2 && a[0].insertEntries.every((e) => e.dr === 0 && e.cr === 0));
a = plan([V({ id: 'l6', amount: 0 })], { l6: [ent('l6', 'x', '3301', 250, 0)] }, { l6: [posted('l6', [])] });
ok('a voucher whose legs produce no rows still loses its stale entries', a[0].deleteEntries.length === 1 && !a[0].insertEntries.length);
a = plan([V({ id: 'l3' })], { l3: [ent('l3', 'l3-dr', '3301', 250, 0), ent('l3', 'l3-cr', '1102', 0, 250)] }, { l3: [posted('l3', [L('3301', 'Dr', 25000), L('1102', 'Cr', 25000)])] });
ok('already consistent → nothing', a.length === 0);
a = plan([V({ id: 'l4' })], { l4: [ent('l4', 'l4-dr', '3301', 250, 0), ent('l4', 'l4-cr', '1102', 0, 250)] }, {});
ok('live with no journal event → one voucher.posted, entries kept', a[0].events.length === 1 && a[0].events[0].eventType === 'voucher.posted' && !a[0].deleteEntries.length && !a[0].insertEntries.length);
ok('pending vouchers are skipped', plan([V({ id: 'l5', approvalStatus: 'pending' })], { l5: [ent('l5', 'x', '3301', 9, 0)] }, {}).length === 0);
const e2 = [posted('p', [L('a', 'Dr', 1)], 1), { ...posted('p', [L('b', 'Dr', 1)], 3), event_type: 'voucher.reposted' }, { ...posted('p', [L('c', 'Dr', 1)], 5), event_type: 'voucher.reposted' }];
ok('current posting = latest reposted', currentPosting(e2).sequence === 5);

console.log('SQL');
const acts = plan([V({ id: 'l1' }), V({ id: 'c1', isDeleted: true })],
  { l1: [ent('l1', 'l1-dr', '3301', 500, 0), ent('l1', 'l1-cr', '1102', 0, 500)], c1: [ent('c1', 'dr', '3301', 1, 0)] },
  { l1: [posted('l1', [L('3301', 'Dr', 50000), L('1102', 'Cr', 50000)])] });
const sql = buildConsistencySql({ runAt: AT, actions: acts });
ok('one transaction', /^[\s\S]*\nbegin;[\s\S]*\ncommit;\s*$/.test(sql));
ok('refuses a second apply', new RegExp(`from public\\.data_fix_log where fix = '${FIX}';\\s*if n > 0 then raise exception '${FIX}: already applied`).test(sql));
ok('re-checks each voucher row and journal sequence before writing', /changed since the plan/.test(sql) && sql.indexOf('changed since the plan') < sql.indexOf('delete from public.voucher_entries'));
ok('logs every deleted entry with its FULL old row before deleting', sql.indexOf("'voucher_entry_deleted'") > 0 && sql.indexOf("'voucher_entry_deleted'") < sql.indexOf('delete from public.voucher_entries'));
ok('post-check: entries = journal per account, cancelled = nothing', /post-check failed for/.test(sql) && /union select vid, acc from n/.test(sql));
ok('never updates or deletes a vouchers row or a journal event', !/update public\.vouchers|delete from public\.vouchers|delete from public\.ledger_events/.test(sql));
const undo = buildConsistencyUndoSql({ runAt: AT });
ok('undo: removes inserted events + entries, re-inserts deleted entries from the log', /delete from public\.ledger_events where event_id in/.test(undo) && /delete from public\.voucher_entries where id in/.test(undo)
  && /jsonb_populate_record\(null::public\.voucher_entries, old_row\)/.test(undo) && /entity = 'voucher_entry_deleted'/.test(undo));

console.log(`\nheal-voucher-consistency: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
