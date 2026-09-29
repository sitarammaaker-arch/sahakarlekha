#!/usr/bin/env node
// S3-f-3 · static guard on migration 083 (update_stock_document, _cancel_voucher_core, cancel_voucher)
// and the updateSale / updatePurchase wiring. CI-safe.
// Behaviour on a restored backup: scripts/db-harness/tests/s3f3-update-stock-document.mjs.
//
// Run: node scripts/test-s3f3-update-stock-document.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(pathResolve(HERE, '../supabase/migrations/083_update_stock_document.sql'), 'utf8');
const code = raw.replace(/--[^\n]*/g, ' ');
const down = readFileSync(pathResolve(HERE, '../supabase/migrations/083_update_stock_document_down.sql'), 'utf8');
const fnOf = (name) => { const a = code.indexOf(`create or replace function public.${name}(`); return code.slice(a, code.indexOf('$$;', a) + 3); };
const core = fnOf('_cancel_voucher_core'), cv = fnOf('cancel_voucher'), up = fnOf('update_stock_document');
const b = up.slice(up.indexOf('begin'));
const dc = readFileSync(pathResolve(HERE, '../src/contexts/DataContext.tsx'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };
const firstWrite = b.indexOf('_cancel_voucher_core(v_sid');

console.log('_cancel_voucher_core + cancel_voucher');
ok('core is private (no client grant)', /revoke all on function public\._cancel_voucher_core\(text, text, text, text\) from public, anon, authenticated/.test(code) && !/grant execute on function public\._cancel_voucher_core/.test(code));
ok('core keeps every 078 check and write (lock, reversed, engine, locks, closed FY, entries, lines, journal)', ['for update', 'voucher_reversed', 'engine_voucher', 'fy_locked', 'period_locked', 'voucher_in_closed_fy',
  'delete from public.voucher_entries', "set status = 'reversed'", "'voucher.cancelled'", '_voucher_flip_legs'].every((t) => core.includes(t)));
ok('cancel_voucher = identity + role claim + jwt_can_delete, then the core', /if not public\.jwt_can_delete\(\) then raise exception 'post_voucher:role_cannot_delete'/.test(cv)
  && /return public\._cancel_voucher_core\(v_sid, p_id, p_reason, p_deleted_by\)/.test(cv) && /grant execute on function public\.cancel_voucher\(text, text, text\) to authenticated/.test(code));

console.log('update_stock_document');
ok('SECURITY DEFINER, search_path empty', /security definer\s+set search_path = ''/.test(up));
ok('society from the JWT; role claim required; jwt_can_WRITE (an edit, not a delete)', /v_sid\s+text := public\.get_current_society_id\(\)/.test(up) && /post_voucher:no_role_claim/.test(b) && /if not public\.jwt_can_write\(\)/.test(b));
ok('row locked FOR UPDATE in the JWT society; a deleted document refused', /society_id::text = \$2 for update/.test(b) && /post_voucher:document_cancelled/.test(b));
for (const c of ['document_not_found', 'fy_locked', 'period_locked', 'voucher_in_closed_fy', 'bad_movement', 'movement_type_mismatch', 'bad_movement_qty', 'unknown_item', 'no_items']) {
  ok(`${c} checked before the first write`, b.indexOf(`post_voucher:${c}`) > 0 && b.indexOf(`post_voucher:${c}`) < firstWrite);
}
ok('order: old vouchers (core) → old stock back → old movements out → new voucher (post_voucher) → new movements → stock → row', (() => {
  const seq = ['_cancel_voucher_core(v_sid', 'update public.stock_items', 'delete from public.stock_movements', 'public.post_voucher(v_voucher', 'insert into public.stock_movements', 'update public.%I t set %s'];
  const at = seq.map((t) => b.indexOf(t)); return at.every((x, i) => x > 0 && (i === 0 || x > at[i - 1]));
})());
ok('new movements keep the document\'s SAME number', /\(x ->> 'amount'\)::numeric, v_doc\.no, x ->> 'narration'/.test(b));
ok('row updated in place: identity fields never taken from the edit; voucherId renewed; extra arrays cleared', /p_doc - 'id' - 'society_id' - v_nocol - 'createdAt' - 'isDeleted' - 'jurisdiction'/.test(b)
  && /jsonb_build_object\('voucherId', p_voucher ->> 'id', v_extracol, null\)/.test(b) && /column_name not in \('id', 'society_id', v_nocol, 'createdAt', 'isDeleted', 'jurisdiction'\)/.test(b));
ok('returns the new voucher number and every journal event', /'voucherNo', v_vno/.test(b) && /'events', v_events/.test(b));
ok('EXECUTE revoked from public/anon, granted to authenticated', /revoke all on function public\.update_stock_document\(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, text, text\) from public, anon/.test(code)
  && /grant execute on function public\.update_stock_document\(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, text, text\) to authenticated/.test(code));
ok("records '083' last; down restores 078's cancel_voucher and drops the new functions", /values \('083', 'update_stock_document'\)\s*on conflict \(version\) do nothing;\s*commit;\s*$/.test(raw)
  && /create or replace function public\.cancel_voucher/.test(down) && /drop function if exists public\.update_stock_document/.test(down) && /drop function if exists public\._cancel_voucher_core/.test(down) && /version = '083'/.test(down)
  && down.indexOf('create or replace function public.cancel_voucher') < down.indexOf('drop function if exists public._cancel_voucher_core'));

console.log('App wiring');
const h = dc.slice(dc.indexOf('const postStockDocumentEdit = ('), dc.indexOf('// S3-e-1 · the ONE way a parent-record cascade'));
ok('postStockDocumentEdit calls update_stock_document with the lib payload', /buildStockDocumentPayload\(kind, doc, voucher, event, movements\)/.test(h) && /supabase\.rpc\('update_stock_document', \{/.test(h));
ok('failure (error or rejection) → undo + destructive toast + reportError', /args\.undo\(\);/.test(h) && /variant: 'destructive', duration: 15000/.test(h) && /reportError\(`\$\{kind\}-edit-post-service`/.test(h) && (h.match(/fail\(/g) || []).length >= 2);
ok('success restamps the voucher number and swaps the journal events', /voucherNo: r\.voucherNo!/.test(h) && /filter\(e => e\.eventId !== event\.eventId\), \.\.\.evs\]/.test(h));
for (const [fn, kind, no] of [['updateSale', 'sale', 'saleNo'], ['updatePurchase', 'purchase', 'purchaseNo']]) {
  const a = dc.indexOf(`const ${fn} = useCallback(`);
  const body = dc.slice(a, dc.indexOf('\n  const ', a + 40));
  ok(`${fn}: every DB write is skipped under the posting service`, /if \(!server\) supabase\.from\('stock_items'\)\.update/.test(body) && new RegExp(`if \\(!server\\) supabase\\.from\\('stock_movements'\\)\\.delete\\(\\)\\.eq\\('referenceNo', original\\.${no}\\)`).test(body)
    && /\} else cancelLinkedVouchers\(linkedIds,/.test(body) && /if \(!server\) persistMovement\(mv\);/.test(body));
  ok(`${fn}: addVoucher hands the voucher over (persistWith) and a refused voucher undoes the local edit`, /server \? \{ persistWith: \(v, ev, rollback\) => \{ viaServer = \{ v, ev, rollback \}; \} \} : undefined/.test(body) && /if \(server && !newVoucher\.id\) \{ undoLocal\(\); return null; \}/.test(body));
  ok(`${fn}: server path calls postStockDocumentEdit('${kind}') and returns before the table upsert`, new RegExp(`postStockDocumentEdit\\(\\{ kind: '${kind}'`).test(body) && body.indexOf('postStockDocumentEdit(') < body.indexOf(".upsert(withSoc(payload))"));
  ok(`${fn}: undo restores old vouchers, movements, stock (+rate) and the original row`, /const undoLocal = \(\) => \{/.test(body) && /\.\.\.oldMovs\]/.test(body) && /stockBefore\.get\(i\.id\)!\.cs, purchaseRate: stockBefore\.get\(i\.id\)!\.rate/.test(body) && /x\.id === id \? original : x/.test(body));
}

console.log(`\nS3-f-3 update_stock_document (static): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
