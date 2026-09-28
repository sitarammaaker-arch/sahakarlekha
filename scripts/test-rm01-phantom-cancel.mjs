#!/usr/bin/env node
// RM-01 phantom cancel · classification rules and SQL shape (CI-safe, no DB).
// The end-to-end run against the restored backup is scripts/db-harness/tests/rm01-phantom-cancel.mjs.
//
// Run: node scripts/test-rm01-phantom-cancel.mjs

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const { classifyLoopVouchers, buildForwardSql, buildUndoSql, FIX } = await import(pathToFileURL(pathResolve(HERE, 'rm01-phantom-cancel.mjs')).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};

const loop = (id, member, acc, amt, date, createdAt, extra = {}) => ({
  id, voucherNo: id, memberId: member, creditAccountId: acc, debitAccountId: '3301', amount: amt, date, createdAt,
  createdBy: 'System', narration: `${acc === '1102' ? 'Share Capital' : 'Admission Fee'} received from X`, lines: [], isDeleted: false, ...extra,
});
const manual = (id, member, acc, amt, date, createdAt, extra = {}) => ({ ...loop(id, member, acc, amt, date, createdAt), createdBy: null, ...extra });

console.log('Classification');
const V = [
  manual('m1s', 'M1', '1102', 100, '1990-01-01', '2026-05-01T00:00:00'), loop('a1s', 'M1', '1102', 100, '1990-01-01', '2026-08-01T00:00:00'),
  manual('m1a', 'M1', '4407', 10, '1990-01-01', '2026-05-01T00:00:00'), loop('a1a', 'M1', '4407', 10, '1990-01-01', '2026-08-01T00:00:00'),
  loop('a2s', 'M2', '1102', 50, '1991-01-01', '2026-08-01T00:00:00'),                                   // no twin → solo
  manual('m3s', 'M3', '1102', 70, '1992-01-01', '2026-09-01T00:00:00'), loop('a3s', 'M3', '1102', 70, '1992-01-01', '2026-08-01T00:00:00'), // twin is NEWER
  manual('m4s', 'M4', '1102', 80, '1993-01-01', '2026-05-01T00:00:00'), loop('a4s', 'M4', '1102', 90, '1993-01-01', '2026-08-01T00:00:00'), // amount differs
  manual('m5s', 'M5', '1102', 60, '1994-01-01', '2026-05-01T00:00:00', { isDeleted: true }), loop('a5s', 'M5', '1102', 60, '1994-01-01', '2026-08-01T00:00:00'), // twin deleted
  manual('m6s', 'M6', '1102', 40, '1995-01-01', '2026-05-01T00:00:00'), loop('a6s', 'M6', '1102', 40, '1995-02-01', '2026-08-01T00:00:00'), // date differs
  loop('a7s', 'M7', '1102', 30, '1996-01-01', '2026-08-01T00:00:00', { lines: [{ accountId: '1102', type: 'Cr', amount: 30 }] }), // multi-line: out of scope
  loop('a8s', 'M8', '1102', 20, '1997-01-01', '2026-08-01T00:00:00', { isDeleted: true }),              // already deleted
];
const { duplicates, solo, twinOf } = classifyLoopVouchers(V);
const dIds = duplicates.map((v) => v.id).sort().join(',');
ok('exact older twin (same member, account, amount, date) → duplicate', dIds === 'a1a,a1s', dIds);
ok('each duplicate points at its twin', twinOf.get('a1s') === 'm1s' && twinOf.get('a1a') === 'm1a');
const sIds = solo.map((v) => v.id).sort().join(',');
ok('no twin / newer twin / different amount / deleted twin / different date → solo (kept)', sIds === 'a2s,a3s,a4s,a5s,a6s', sIds);
ok('multi-line and already-deleted loop vouchers are neither', !dIds.includes('a7s') && !sIds.includes('a7s') && !dIds.includes('a8s') && !sIds.includes('a8s'));
ok('a non-loop voucher is never a duplicate', duplicates.every((v) => v.createdBy === 'System'));

console.log('Forward SQL');
const ev = (v) => ({ eventId: `${FIX}-${v.id}`, eventType: 'voucher.cancelled', schemaVersion: 1, tenantId: 'S1', jurisdiction: null, aggregateType: 'voucher',
  aggregateId: v.id, sequence: 2, occurredAt: '2026-09-28T00:00:00.000Z', producer: { kind: 'import', id: FIX }, reversalOf: `p-${v.id}`, payload: { lines: [] } });
const sql = buildForwardSql({ societyId: 'S1', duplicates, events: duplicates.map(ev), runAt: '2026-09-28T00:00:00.000Z', actor: 'A', reason: "R's" });
const pos = (s) => sql.indexOf(s);
ok('one transaction', /^--[^\n]*\n[\s\S]*\nbegin;\n[\s\S]*\ncommit;\n$/.test(sql));
ok('checks "already applied" and the exact live count before changing anything',
  pos('already applied') > 0 && pos('expected 2 live target vouchers') > 0 && pos('already applied') < pos('update public.vouchers'));
ok('logs vouchers and entries BEFORE updating / deleting', pos("'voucher', v.id, to_jsonb(v)") < pos('update public.vouchers') && pos("'voucher_entry', e.id, to_jsonb(e)") < pos('delete from public.voucher_entries'));
ok('the only DELETE is of the targets\' voucher_entries', (sql.match(/\bdelete from\b/gi) || []).length === 1 && /delete from public\.voucher_entries e using fx_targets t/.test(sql));
ok('updates only the four cancel columns of the targets', /set "isDeleted" = true, "deletedAt" = [^,]+, "deletedBy" = [^,]+, "deletedReason" = [^\n]+\nfrom fx_targets t\nwhere t\.id = v\.id and v\.society_id::text = 'S1';/.test(sql));
ok('appends one voucher.cancelled per duplicate with reversal_of', (sql.match(/\('rm01-phantom-cancel-[^']+', 'voucher\.cancelled', 1,/g) || []).length === 2 && sql.includes("'p-a1s'"));
ok('writes one audit row per duplicate', (sql.match(/'cancel', \$fx\$/g) || []).length === 2);
ok('post-check rolls back on any mismatch', pos('post-check failed') > pos('insert into public.audit_log'));
ok("quotes are escaped (R's)", sql.includes("'R''s'"));

console.log('Undo SQL');
const undo = buildUndoSql({ societyId: 'S1', runAt: 'x' });
ok('restores voucher flags from data_fix_log', /"isDeleted"\s+= coalesce\(\(l\.old_row->>'isDeleted'\)::boolean, false\)/.test(undo));
ok('re-inserts the logged voucher_entries', /jsonb_populate_record\(null::public\.voucher_entries, l\.old_row\)/.test(undo));
ok("removes only this fix's journal events", new RegExp(`event_id like '${FIX}-%'`).test(undo));
ok('appends restore audit rows and clears its log', /'restore'/.test(undo) && /delete from public\.data_fix_log where fix = /.test(undo));

console.log(`\nRM-01 phantom cancel (unit): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
