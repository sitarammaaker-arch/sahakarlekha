#!/usr/bin/env node
// voucher_entries sync + member-receipt journal event. CI-safe.
//
// 1. syncEntries must send ONLY real voucher_entries columns. VoucherEntry.societyId (the replay
//    model's field) has no column; sending it made PostgREST reject every upsert — no voucher created
//    after 2026-09-26 had entries in production. Checked against the REAL builder's output.
// 2. Member joining receipts must emit the same `voucher.posted` journal event addVoucher does,
//    persisted only after the voucher row is confirmed.
//
// Run: node scripts/test-voucher-entries-sync.mjs

import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs'; import { fileURLToPath, pathToFileURL } from 'node:url'; import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)}; const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }`));
const { buildVoucherEntries } = await import(pathToFileURL(pathResolve(SRC, 'lib/voucherUtils.ts')).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};

// public.voucher_entries columns in production (information_schema, 2026-09-27).
const COLUMNS = new Set(['dr', 'cr', 'id', 'voucherId', 'accountId', 'narration', 'society_id', 'workOrderId', 'costCentreId', 'jurisdiction']);

console.log('syncEntries row shape');
const dc = readFileSync(pathResolve(SRC, 'contexts/DataContext.tsx'), 'utf8');
const sync = dc.slice(dc.indexOf('const syncEntries = (v: Voucher) => {'), dc.indexOf('// Delete entries for a voucher'));
const m = sync.match(/buildVoucherEntries\(v, sid\)\.map\(\(\{ societyId: _sid, \.\.\.e \}\) => \(\{ \.\.\.e, society_id: sid, jurisdiction: jurisdictionRef\.current \}\)\)/);
ok('syncEntries drops societyId and adds society_id + jurisdiction', !!m);
// Apply the same mapping to the REAL builder's output for a legacy two-leg and a multi-line voucher.
const toRow = ({ societyId: _sid, ...e }) => ({ ...e, society_id: 'S1', jurisdiction: 'hr' });
const legacy = { id: 'v1', type: 'receipt', date: '2026-09-28', debitAccountId: '3301', creditAccountId: '1102', amount: 100, narration: 'x', createdAt: '' };
const multi = { ...legacy, id: 'v2', lines: [{ id: 'a', accountId: '3301', type: 'Dr', amount: 100 }, { id: 'b', accountId: '1102', type: 'Cr', amount: 60 }, { id: 'c', accountId: '4407', type: 'Cr', amount: 40 }], workOrderId: 'WO1' };
for (const [label, v] of [['legacy two-leg', legacy], ['multi-line with a dimension', multi]]) {
  const rows = buildVoucherEntries(v, 'S1').map(toRow);
  const bad = [...new Set(rows.flatMap((r) => Object.keys(r)).filter((k) => !COLUMNS.has(k)))];
  ok(`${label}: every key is a real voucher_entries column`, rows.length > 0 && bad.length === 0, bad.join(','));
}
ok('the raw builder output DOES carry societyId (why the mapping is needed)', 'societyId' in buildVoucherEntries(legacy, 'S1')[0]);
ok('a failed sync is reported, not only console.warn', /reportError\('voucher-entries-sync'/.test(sync));
// An edit rebuilds lines with new ids — the old rows must go, or the voucher counts twice (Assandh JV/2384).
ok('after a successful upsert, this voucher\'s rows that are no longer its lines are deleted',
  /return; \}[\s\S]*?\.delete\(\)\.eq\('voucherId', v\.id\)\.not\('id', 'in', `\(\$\{keep\}\)`\)/.test(sync));
ok('a failed upsert never reaches the cleanup (returns first)', /reportError\('voucher-entries-sync', error\.message, \{ voucherId: v\.id \}\); return; \}/.test(sync));

console.log('Member receipt journal event');
const helper = dc.slice(dc.indexOf('const postJoiningReceipts = useCallback'), dc.indexOf('const addMember = useCallback'));
ok("builds a 'voucher.posted' event with the posting legs", /eventType: 'voucher\.posted'/.test(helper) && /payload: \{ lines: voucherPostingLines\(v\), \.\.\.voucherEventMeta\(v\) \}/.test(helper));
ok('appends it only after the voucher row is confirmed', /onBaseSuccess: \(\) => \{ if \(postedEvent\) persistLedgerEvent\(postedEvent\); \}/.test(helper));
ok('drops it with the voucher when the save fails', /onBaseFail: \(\) => \{[\s\S]*ledgerEventsRef\.current = ledgerEventsRef\.current\.filter\(e => e\.eventId !== postedEvent!\.eventId\)/.test(helper));

console.log(`\nvoucher_entries sync + receipt journal: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
