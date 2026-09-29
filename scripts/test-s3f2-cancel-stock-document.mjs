#!/usr/bin/env node
// S3-f-2 · static guard on migration 082 (cancel_stock_document) and the deleteSale / deletePurchase
// wiring. CI-safe. Behaviour on a restored backup: scripts/db-harness/tests/s3f2-cancel-stock-document.mjs.
//
// Run: node scripts/test-s3f2-cancel-stock-document.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(pathResolve(HERE, '../supabase/migrations/082_cancel_stock_document.sql'), 'utf8');
const code = raw.replace(/--[^\n]*/g, ' ');
const down = readFileSync(pathResolve(HERE, '../supabase/migrations/082_cancel_stock_document_down.sql'), 'utf8');
const f = code.slice(code.indexOf('create or replace function public.cancel_stock_document('), code.indexOf('$$;') + 3);
const b = f.slice(f.indexOf('begin'));
const dc = readFileSync(pathResolve(HERE, '../src/contexts/DataContext.tsx'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };
const firstWrite = b.indexOf('v_res := public.cancel_voucher(');

console.log('cancel_stock_document (082)');
ok('SECURITY DEFINER, search_path empty', /security definer\s+set search_path = ''/.test(f));
ok('society from the JWT; role claim required; jwt_can_delete()', /v_sid\s+text := public\.get_current_society_id\(\)/.test(f) && /post_voucher:no_role_claim/.test(b) && /if not public\.jwt_can_delete\(\)/.test(b));
ok('sale → sales/gstVoucherIds, purchase → purchases/taxVoucherIds, else bad_kind', /v_table := 'sales'; v_nocol := 'saleNo'; v_extracol := 'gstVoucherIds'/.test(b) && /v_table := 'purchases'; v_nocol := 'purchaseNo'; v_extracol := 'taxVoucherIds'/.test(b) && /post_voucher:bad_kind/.test(b));
ok('row locked FOR UPDATE within the JWT society', /where id = \$1 and society_id::text = \$2 for update/.test(b));
ok('already deleted → already_cancelled before any write', b.indexOf("'already_cancelled'") > 0 && b.indexOf("'already_cancelled'") < firstWrite);
for (const c of ['document_not_found', 'fy_locked', 'period_locked', 'voucher_in_closed_fy']) {
  ok(`${c} checked before any write`, b.indexOf(`post_voucher:${c}`) > 0 && b.indexOf(`post_voucher:${c}`) < firstWrite);
}
ok('linked vouchers = voucherId + the extra array, live, this society, not engine → cancel_voucher', /jsonb_array_elements_text/.test(b) && /v\.society_id::text = v_sid and not coalesce\(v\."isDeleted", false\) and coalesce\(v\.origin, ''\) <> 'engine'/.test(b)
  && /v_res := public\.cancel_voucher\(v_vid, p_reason, p_by\);/.test(b));
ok('stock restored FROM the movements (sale +qty, purchase −qty floored) BEFORE they are deleted', b.indexOf('update public.stock_items') < b.indexOf('delete from public.stock_movements')
  && /"currentStock" = coalesce\(s\."currentStock", 0\) \+ q\.qty/.test(b) && /greatest\(0, coalesce\(s\."currentStock", 0\) - q\.qty\)/.test(b));
ok('movements deleted by the document number, society-scoped', /delete from public\.stock_movements m where m\.society_id::text = v_sid and m\."referenceNo" = v_doc\.no/.test(b));
ok('row kept, isDeleted = true (society-scoped)', /set "isDeleted" = true where id = \$1 and society_id::text = \$2/.test(b));
ok('returns the voucher.cancelled events', /'events', v_events/.test(b));
ok('EXECUTE revoked from public/anon, granted to authenticated', /revoke all on function public\.cancel_stock_document\(text, text, text, text\) from public, anon/.test(code) && /grant execute on function public\.cancel_stock_document\(text, text, text, text\) to authenticated/.test(code));
ok("records '082' last; down drops it", /values \('082', 'cancel_stock_document'\)\s*on conflict \(version\) do nothing;\s*commit;\s*$/.test(raw) && /drop function if exists public\.cancel_stock_document/.test(down) && /version = '082'/.test(down));

console.log('App wiring');
const h = dc.slice(dc.indexOf('const cancelStockDocument = ('), dc.indexOf('// S3-e-1 · the ONE way a parent-record cascade'));
ok('cancelStockDocument calls cancel_stock_document', /supabase\.rpc\('cancel_stock_document', \{ p_kind: kind, p_id: doc\.id, p_reason: reason, p_by:/.test(h));
ok('optimistic local changes mirror the server (row, vouchers, movements, stock from movements)', /setVouchersState\(prev => prev\.map\(cancelV\)\)/.test(h) && /setStockMovementsState\(prev => prev\.filter\(m => m\.referenceNo !== docNo\)\)/.test(h) && /qtyBy\.get\(i\.id\)/.test(h));
ok('failure (error or rejection) restores row, vouchers, movements and stock + destructive toast + reportError', (h.match(/undo\(/g) || []).length >= 2 && /stockBefore\.get\(i\.id\)/.test(h) && /variant: 'destructive', duration: 15000/.test(h) && /reportError\(`\$\{kind\}-cancel-post-service`/.test(h));
ok('movements audit-snapshotted before removal (ECR-21)', /snapshotDeletedMovements\(movs\)/.test(h));
ok('server events swapped into the journal', /mapLedgerEventRows\(/.test(h));
for (const [fn, kind] of [['deleteSale', 'sale'], ['deletePurchase', 'purchase']]) {
  const a = dc.indexOf(`const ${fn} = useCallback(`);
  const body = dc.slice(a, dc.indexOf('\n  const ', a + 40));
  ok(`${fn}: guards first, then the server branch (posting service) that returns before the old path`, body.indexOf('guardFYLocked()') < body.indexOf('if (postingServiceRef.current)')
    && new RegExp(`cancelStockDocument\\('${kind}'`).test(body) && body.indexOf('cancelStockDocument(') < body.indexOf('cancelLinkedVouchers('));
}

console.log(`\nS3-f-2 cancel_stock_document (static): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
