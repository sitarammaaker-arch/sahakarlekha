#!/usr/bin/env node
// heal-voucher-derived · which vouchers get healed and the SQL's safety shape. CI-safe.
// Run: node scripts/test-heal-voucher-derived.mjs

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const { planHeal, buildHealSql, buildHealUndoSql, FIX } = await import(pathToFileURL(pathResolve(HERE, 'heal-voucher-derived.mjs')).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};

console.log('planHeal');
const V = [
  { id: 'a', isDeleted: false },                               // no entries, no posting → both
  { id: 'b', isDeleted: false },                               // has entries, has posting → neither
  { id: 'c', isDeleted: false },                               // has entries, no posting → posting only
  { id: 'd', isDeleted: true },                                // deleted → neither
  { id: 'e', isDeleted: false, approvalStatus: 'pending' },    // pending → neither
  { id: 'f', isDeleted: false },                               // no posting but a cancel event → no posting heal
];
const entries = new Set(['b', 'c', 'f']);
const events = new Map([['b', [{ event_type: 'voucher.posted' }]], ['f', [{ event_type: 'voucher.cancelled' }]]]);
const { needEntries, needPosting } = planHeal(V, entries, events);
ok('entries healed only for live, approved vouchers without any', needEntries.map((v) => v.id).join(',') === 'a');
ok('posting healed only for live, approved vouchers with no posting and no cancel', needPosting.map((v) => v.id).sort().join(',') === 'a,c');
ok('reposted counts as a posting', planHeal([{ id: 'r' }], new Set(['r']), new Map([['r', [{ event_type: 'voucher.reposted' }]]])).needPosting.length === 0);

console.log('Forward SQL');
const e1 = { id: 'a-1', voucherId: 'a', accountId: '3301', dr: 100, cr: 0, narration: "R's", society_id: 'S1', jurisdiction: 'hr' };
const e2 = { id: 'a-2', voucherId: 'a', accountId: '1102', dr: 0, cr: 100, society_id: 'S1' };
const ev = { eventId: `${FIX}-a`, eventType: 'voucher.posted', schemaVersion: 1, tenantId: 'S1', jurisdiction: 'hr', aggregateType: 'voucher', aggregateId: 'a', sequence: 1, occurredAt: '2026-09-28T00:00:00.000Z', producer: { kind: 'import', id: FIX }, payload: { lines: [] } };
const sql = buildHealSql({ runAt: 'x', entries: [e1, e2], events: [ev] });
const pos = (s) => sql.indexOf(s);
ok('one transaction', /\nbegin;\n[\s\S]*\ncommit;\n$/.test(sql));
ok('refuses if planned entries or journal events already exist (before inserting)', pos('already exist') > 0 && pos('already have journal events') > 0 && pos('already exist') < pos('insert into public.voucher_entries'));
ok('logs every inserted row BEFORE inserting', pos("'voucher_entry', 'a-1'") > 0 && pos("'ledger_event', 'heal-voucher-derived-a'") > 0 && pos('insert into public.data_fix_log') < pos('insert into public.voucher_entries'));
ok('never updates or deletes anything', !/\bupdate\s+public\.|\bdelete\s+from\b/i.test(sql));
ok('inserts only real voucher_entries columns', /insert into public\.voucher_entries \(id, "voucherId", "accountId", dr, cr, narration, society_id, "workOrderId", "costCentreId", jurisdiction\)/.test(sql));
ok('post-check rolls back on a count mismatch', /if ne <> 2 or nv <> 1 then raise exception/.test(sql));
ok("quotes escaped (R's)", sql.includes("'R''s'"));
const onlyEntries = buildHealSql({ runAt: 'x', entries: [e1], events: [] });
ok('no events → no ledger_events insert', !/insert into public\.ledger_events/.test(onlyEntries));

console.log('Undo SQL');
const undo = buildHealUndoSql({ runAt: 'x' });
ok('deletes exactly the logged entries and events, then the log', /delete from public\.voucher_entries where id in \(select entity_id from public\.data_fix_log where fix = 'heal-voucher-derived' and entity = 'voucher_entry'\)/.test(undo)
  && /delete from public\.ledger_events where event_id in \(select entity_id from public\.data_fix_log where fix = 'heal-voucher-derived' and entity = 'ledger_event'\)/.test(undo)
  && /delete from public\.data_fix_log where fix = 'heal-voucher-derived'/.test(undo));

console.log(`\nheal-voucher-derived: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
