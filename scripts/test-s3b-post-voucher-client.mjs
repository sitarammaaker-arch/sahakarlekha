#!/usr/bin/env node
// S3-b · the app side of post_voucher: unit tests of src/lib/ledger/postVoucherClient.ts plus static
// checks of the addVoucher wiring in DataContext (flag-gated, rollback on refusal, flag-off unchanged).
// CI-safe (no DB). The same payload against a real restored DB: scripts/db-harness/tests/s3b-post-voucher-client.mjs.
//
// Run: node scripts/test-s3b-post-voucher-client.mjs

import { readFileSync } from 'node:fs';
import { register } from 'node:module';
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
const imp = (p) => import(pathToFileURL(pathResolve(SRC, p)).href);
const { buildPostVoucherPayload, postVoucherErrorCode, postVoucherMessage } = await imp('lib/ledger/postVoucherClient.ts');
const { voucherPostingLines, voucherEventMeta } = await imp('lib/ledger/voucherEvent.ts');
const { buildEvent } = await imp('lib/ledger/event.ts');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};
const eventOf = (v) => buildEvent({ eventType: 'voucher.posted', tenantId: 'SOC', aggregateType: 'voucher', aggregateId: v.id, sequence: 1,
  producer: { kind: 'human', id: 'tester' }, payload: { lines: voucherPostingLines(v), ...voucherEventMeta(v) } },
  { eventId: 'ev-1', occurredAt: '2026-09-29T10:00:00.000Z' });
const shape = (ls) => JSON.stringify(ls.map(({ accountId, drCr, amountMinor }) => ({ accountId, drCr, amountMinor })));

console.log('Payload — legacy two-leg voucher');
const v1 = { id: 'v1', voucherNo: 'JV/2026-27/001', type: 'journal', date: '2026-05-15', debitAccountId: '5201', creditAccountId: '3301',
  amount: 1234.5, narration: 'n', createdAt: 'x', createdBy: 'u', editHistory: [{ a: 1 }], society_id: 'SPOOF' };
const p1 = buildPostVoucherPayload(v1, eventOf(v1));
ok('2 legs, Dr 5201 / Cr 3301, 123450 paise each', p1.p_lines.length === 2 && p1.p_lines[0].accountId === '5201' && p1.p_lines[0].drCr === 'Dr'
  && p1.p_lines[1].accountId === '3301' && p1.p_lines[1].drCr === 'Cr' && p1.p_lines.every((l) => l.amountMinor === 123450));
ok('legs equal the event lines (what the server compares)', shape(p1.p_lines) === shape(p1.p_event.payload.lines));
ok('society_id and editHistory never sent (server takes the society from the JWT)', !('society_id' in p1.p_voucher) && !('editHistory' in p1.p_voucher));
ok('the input voucher is not mutated', v1.society_id === 'SPOOF' && Array.isArray(v1.editHistory));
ok('event: voucher.posted, sequence 1, this voucher, same event id', p1.p_event.event_type === 'voucher.posted' && p1.p_event.sequence === 1
  && p1.p_event.aggregate_id === 'v1' && p1.p_event.event_id === 'ev-1' && p1.p_event.producer_kind === 'human' && p1.p_event.on_behalf_of === null);

console.log('Payload — multi-line voucher');
const v2 = { id: 'v2', voucherNo: 'JV/2026-27/002', type: 'journal', date: '2026-05-15', amount: 300, narration: '', createdAt: 'x', createdBy: 'u',
  lines: [{ id: 'a', accountId: '5201', type: 'Dr', amount: 200.1 }, { id: 'b', accountId: '5202', type: 'Dr', amount: 99.9 }, { id: 'c', accountId: '3301', type: 'Cr', amount: 300 }] };
const p2 = buildPostVoucherPayload(v2, eventOf(v2));
const sum = (side) => p2.p_lines.filter((l) => l.drCr === side).reduce((s, l) => s + l.amountMinor, 0);
ok('3 legs, balanced to the paisa (30000)', p2.p_lines.length === 3 && sum('Dr') === 30000 && sum('Cr') === 30000, `${sum('Dr')}/${sum('Cr')}`);
ok('leg ids come from the voucher lines', p2.p_lines.map((l) => l.id).join() === 'a,b,c');
ok('multi-line legs equal the event lines', shape(p2.p_lines) === shape(p2.p_event.payload.lines));

console.log('Error codes → Hindi');
ok('extracts the code from a PostgREST message', postVoucherErrorCode('post_voucher:period_locked') === 'period_locked' && postVoucherErrorCode('ERROR: post_voucher:fy_locked (P0001)') === 'fy_locked');
ok('other errors → null', postVoucherErrorCode('network down') === null && postVoucherErrorCode(undefined) === null);
ok('known code → Devanagari message with the code', /लॉक/.test(postVoucherMessage('period_locked')) && postVoucherMessage('period_locked').includes('(period_locked)'));
ok('every refusal code the SQL raises has a Hindi message',
  ['fy_locked', 'period_locked', 'no_open_fy_for_date', 'too_few_legs', 'unbalanced', 'negative_amount', 'legs_do_not_match_voucher', 'bad_event',
    'event_lines_differ', 'pending_not_supported', 'role_cannot_write', 'no_role_claim', 'not_a_society_user', 'voucher_id_taken']
    .every((c) => /[ऀ-ॿ]/.test(postVoucherMessage(c))));
ok('unknown code → still a message carrying the raw error', postVoucherMessage(null, 'boom').includes('boom'));

console.log('DataContext wiring');
const dc = readFileSync(pathResolve(SRC, 'contexts/DataContext.tsx'), 'utf8');
const add = dc.slice(dc.indexOf('// ── S3-b posting service'), dc.indexOf('// ── Default (flag OFF): table-first save'));
ok('the RPC branch exists and sits BEFORE the default table path', add.length > 200);
ok('gated on the society flag AND a posted (non-pending) voucher', /if \(postingServiceRef\.current && shadowEvent\)/.test(add));
ok("calls supabase.rpc('post_voucher') with the lib payload", /supabase\.rpc\('post_voucher', p\)/.test(add) && /buildPostVoucherPayload\(v, ev\)/.test(add));
ok('a refusal rolls back + destructive toast ≥10s + reportError (RULE 1)', /rollbackOptimistic\(\)/.test(add) && /variant: 'destructive', duration: 15000/.test(add) && /reportError\('voucher-post-service'/.test(add));
ok('network rejection also rolls back', /\(rejection: unknown\) =>[\s\S]*?fail\(/.test(add));
ok('number collision renumbers and retries (bounded)', /isUniqueViolation\(error\) && tries < MAX_RENUMBER_RETRIES/.test(add));
// 096: the official number is issued by post_voucher inside its transaction (gapless) — the client no
// longer pre-issues it, and restamps the number the server returns.
ok('official number comes from post_voucher and is restamped (096)', !/issueOfficialNumber\(/.test(add) && /\(data as \{ voucherNo\?: string \} \| null\)\?\.voucherNo/.test(add));
ok('the RPC branch returns — never falls through to a second save', /return newVoucher;\s*\}\s*$/.test(add));
ok('the RPC branch never calls persistVoucher / persistLedgerEvent (the server writes all four)', !/persistVoucher\(|persistLedgerEvent\(/.test(add));
// Flag-off path: event appended only after base success; a base failure rolls back (RULE 1). Usability
// audit P0-7 added the page callbacks (onSaved after success, onFailed after the rollback).
ok('flag-off path unchanged: persistVoucher, event appended only after base success', /persistVoucher\(newVoucher, \{\s*isUpdate: false,[\s\S]*?onBaseSuccess: \(\) => \{\s*if \(shadowEvent\) persistLedgerEvent\(shadowEvent\);\s*opts\?\.onSaved\?\.\([\s\S]*?\},\s*onBaseFail: \(\) => \{ rollbackOptimistic\(\); opts\?\.onFailed\?\.\(\); \},/.test(dc));
const at = dc.indexOf('const loadFromSupabase = async');
const load = dc.slice(at, at + 900);
ok('flag loaded by a read-only select, reset to false first, false on any error', /postingServiceRef\.current = false;/.test(load)
  && /from\('society_flags'\)\.select\('posting_service'\)/.test(load) && /!error && data\?\.posting_service === true/.test(load));
ok('the flag ref defaults to false', /const postingServiceRef = useRef\(false\);/.test(dc));
ok('the app never writes society_flags', !/from\('society_flags'\)\.(upsert|insert|update|delete)/.test(dc));

console.log(`\nS3-b post_voucher client: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
