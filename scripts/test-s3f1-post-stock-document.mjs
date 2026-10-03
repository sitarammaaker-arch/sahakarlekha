#!/usr/bin/env node
// S3-f-1 · static guard on migration 080 (post_stock_document) and the addSale / addPurchase wiring.
// CI-safe. Behaviour on a restored backup: scripts/db-harness/tests/s3f1-post-stock-document.mjs.
//
// Run: node scripts/test-s3f1-post-stock-document.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(pathResolve(HERE, '../supabase/migrations/080_post_stock_document.sql'), 'utf8');
const code = raw.replace(/--[^\n]*/g, ' ');
const down = readFileSync(pathResolve(HERE, '../supabase/migrations/080_post_stock_document_down.sql'), 'utf8');
const fnOf = (name) => { const a = code.indexOf(`create or replace function public.${name}(`); return code.slice(a, code.indexOf('$$;', a) + 3); };
const f = fnOf('post_stock_document'), h = fnOf('_official_doc_no');
const b = f.slice(f.indexOf('begin'));
const dc = readFileSync(pathResolve(HERE, '../src/contexts/DataContext.tsx'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };
const firstWrite = b.indexOf('v_res := public.post_voucher(');

console.log('post_stock_document (080)');
ok('SECURITY DEFINER, search_path empty', /security definer\s+set search_path = ''/.test(f));
ok('society from the JWT; role claim required; jwt_can_write()', /v_sid\s+text := public\.get_current_society_id\(\)/.test(f) && /post_voucher:no_role_claim/.test(b) && /if not public\.jwt_can_write\(\)/.test(b));
ok("kind limited to sale → sales / purchase → purchases", /if p_kind = 'sale' then v_table := 'sales'; v_nocol := 'saleNo';/.test(b) && /elsif p_kind = 'purchase' then v_table := 'purchases'; v_nocol := 'purchaseNo';/.test(b) && /post_voucher:bad_kind/.test(b));
ok('idempotent: an existing document id → exists (another society → document_id_taken)', /'status', 'exists'/.test(b) && /post_voucher:document_id_taken/.test(b) && b.indexOf("'status', 'exists'") < firstWrite);
for (const c of ['movements_not_array', 'bad_movement', 'movement_type_mismatch', 'bad_movement_qty', 'unknown_item', 'no_items']) {
  ok(`${c} checked before anything is written`, b.indexOf(`post_voucher:${c}`) > 0 && b.indexOf(`post_voucher:${c}`) < firstWrite);
}
ok('items must belong to the JWT society', /s\.id = m ->> 'itemId' and s\.society_id::text = v_sid/.test(b));
ok('official numbers issued BEFORE the voucher; voucher narration + event meta restamped', b.indexOf('_official_doc_no(v_sid, v_prov_no') < firstWrite && b.indexOf("_official_doc_no(v_sid, p_voucher ->> 'voucherNo'") < firstWrite
  && /jsonb_set\(jsonb_set\(p_event, '\{payload,voucherNo\}'/.test(b) && /'\{payload,narration\}'/.test(b));
ok('refType / refId forced to this document', /'refType', p_kind, 'refId', v_doc_id/.test(b));
ok('the voucher goes through post_voucher (all its checks) and must be freshly posted', /v_res := public\.post_voucher\(v_voucher, p_lines, v_event\);\s*if v_res ->> 'status' <> 'posted'/.test(b));
ok('document row: society, jurisdiction, official number, voucher link, live — set server-side', /'society_id', v_sid, 'jurisdiction', v_juris, v_nocol, v_doc_no,\s*'voucherId', p_voucher ->> 'id', 'isDeleted', false/.test(b));
ok('movements carry the official document number and the JWT society', /x ->> 'itemId', p_kind, \(x ->> 'qty'\)::numeric,[\s\S]*?v_doc_no, x ->> 'narration'/.test(b) && /select x ->> 'id', v_sid,/.test(b));
ok('currentStock cache: sale −qty floored at 0, purchase +qty with purchaseRate', /greatest\(0, coalesce\(s\."currentStock", 0\) - q\.qty\)/.test(b) && /"currentStock" = coalesce\(s\."currentStock", 0\) \+ q\.qty, "purchaseRate" = q\.rate/.test(b));
ok('returns numbers, narration and the journal event', /'docNo', v_doc_no/.test(b) && /'voucherNo', v_vno/.test(b) && /'events', \(select/.test(b));
ok('_official_doc_no: private, skips taken numbers, keeps malformed input', /revoke all on function public\._official_doc_no\(text, text, text, text\) from public, anon, authenticated/.test(code)
  && /if not v_taken then return v_try; end if;/.test(h) && /return p_provisional;/.test(h));
ok('EXECUTE revoked from public/anon, granted to authenticated', /revoke all on function public\.post_stock_document\(text, jsonb, jsonb, jsonb, jsonb, jsonb\) from public, anon/.test(code)
  && /grant execute on function public\.post_stock_document\(text, jsonb, jsonb, jsonb, jsonb, jsonb\) to authenticated/.test(code));
ok("records '080' last; down drops both functions", /values \('080', 'post_stock_document'\)\s*on conflict \(version\) do nothing;\s*commit;\s*$/.test(raw)
  && /drop function if exists public\.post_stock_document/.test(down) && /drop function if exists public\._official_doc_no/.test(down) && /version = '080'/.test(down));

console.log('App wiring');
ok('addVoucher: optional persistWith hands over voucher + event + rollback instead of saving', /opts\?: \{ persistWith\?: VoucherPersistWith[;}]/.test(dc)
  && /if \(opts\?\.persistWith && shadowEvent\) \{ opts\.persistWith\(newVoucher, shadowEvent, rollbackOptimistic\); return newVoucher; \}/.test(dc));
const ps = dc.slice(dc.indexOf('const postStockDocument = ('), dc.indexOf('// S3-e-1 · the ONE way a parent-record cascade'));
ok("postStockDocument calls post_stock_document with the lib payload", /buildStockDocumentPayload\(kind, doc, voucher, event, movements\)/.test(ps) && /supabase\.rpc\('post_stock_document', p\)/.test(ps));
ok('failure (error or rejection) → voucher rollback + local undo + destructive toast + reportError', /args\.rollbackVoucher\(\);\s*args\.undoLocal\(\);/.test(ps) && /variant: 'destructive', duration: 15000/.test(ps) && (ps.match(/fail\(/g) || []).length >= 2);
ok('success restamps document number, movements, voucher number/narration and the event', /saleNo: docNo/.test(ps) && /purchaseNo: docNo/.test(ps) && /referenceNo: docNo/.test(ps) && /vPatch/.test(ps) && /mapLedgerEventRows/.test(ps));
for (const [fn, kind] of [['addSale', 'sale'], ['addPurchase', 'purchase']]) {
  const a = dc.indexOf(`const ${fn} = useCallback(`);
  const body = dc.slice(a, dc.indexOf('\n  const ', a + 40));
  ok(`${fn}: persistWith only under the posting service`, /postingServiceRef\.current \? \{ persistWith: \(v, ev, rollback\) => \{ viaServer = \{ v, ev, rollback \}; \} \} : undefined/.test(body));
  ok(`${fn}: no direct stock_items / movement writes on the server path`, /if \(!server\) supabase\.from\('stock_items'\)\.update/.test(body) && /if \(!server\) persistMovement\(mv\);/.test(body));
  ok(`${fn}: server path posts via postStockDocument ('${kind}') and returns before the table save`, new RegExp(`postStockDocument\\(\\{\\s*kind: '${kind}'`).test(body)
    && body.indexOf('postStockDocument(') < body.indexOf('issueOfficialNumber(') && /return (sale|purchase);\s*\}/.test(body));
}

console.log(`\nS3-f-1 post_stock_document (static): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
