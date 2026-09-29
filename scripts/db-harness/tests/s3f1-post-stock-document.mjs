#!/usr/bin/env node
// S3-f-1 · post_stock_document (migration 080) on the restored backup, as real JWT users.
// Precondition: harness up with 072–080 applied. Everything runs inside one rolled-back transaction.
// A sale / purchase must land whole — row + voucher (+ lines, entries, event) + movements + stock —
// with ONE official number everywhere; a refusal must write nothing.
//
// Run: node scripts/db-harness/tests/s3f1-post-stock-document.mjs

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { inRollback } from '../lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '../../..', 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs'; import { fileURLToPath, pathToFileURL } from 'node:url'; import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)}; const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }`));
const imp = (p) => import(pathToFileURL(pathResolve(SRC, p)).href);
const { buildStockDocumentPayload, postVoucherErrorCode } = await imp('lib/ledger/postVoucherClient.ts');
const { voucherPostingLines, voucherEventMeta } = await imp('lib/ledger/voucherEvent.ts');
const { buildEvent } = await imp('lib/ledger/event.ts');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};
const code = (r) => (r.ok ? 'OK' : postVoucherErrorCode(r.error.message) ?? `${r.error.code} ${r.error.message}`);

await inRollback(async (tx) => {
  const [{ sid, fy_start, fy_label }] = (await tx.query(`select society_id as sid, start_date::text as fy_start, fy_label from public.financial_years where status = 'open' and society_id = 'd5e007f0-fef0-48dd-b5dc-7230ce0aa82c'`)).rows;
  const items = (await tx.query(`select id, "currentStock"::numeric cs, "salesAccountId" sa, "purchaseAccountId" pa from public.stock_items where society_id::text = $1 order by id limit 2`, [sid])).rows;
  const [{ other_item }] = (await tx.query(`select id as other_item from public.stock_items where society_id::text <> $1 and id not in (select id from public.stock_items where society_id::text = $1) limit 1`, [sid])).rows;
  for (const [email, role] of [['s3f-admin@harness.test', 'admin'], ['s3f-viewer@harness.test', 'viewer']]) {
    await tx.query(`insert into public.society_users (id, society_id, email, role, name, is_active) values (gen_random_uuid(), $1, $2, $3, 'Harness', true)`, [sid, email, role]);
  }
  const asAdmin = () => tx.as({ email: 's3f-admin@harness.test', user_role: 'admin' });
  const d = fy_start.slice(0, 4) + '-06-14';
  const stock = async (id) => Number((await tx.query(`select "currentStock"::numeric cs from public.stock_items where id = $1`, [id])).rows[0].cs);

  // What addSale / addPurchase build: the document, its voucher (as addVoucher would) and movements.
  const doc = (kind, over = {}) => {
    const id = randomUUID();
    const provNo = `${kind === 'sale' ? 'SL' : 'PUR'}/${fy_label}/001`;
    const acc = kind === 'sale' ? (items[0].sa || '4101') : (items[0].pa || '5101');
    const lines = kind === 'sale'
      ? [{ id: 'l1', accountId: '3301', type: 'Dr', amount: 500 }, { id: 'l2', accountId: acc, type: 'Cr', amount: 500 }]
      : [{ id: 'l1', accountId: acc, type: 'Dr', amount: 500 }, { id: 'l2', accountId: '3301', type: 'Cr', amount: 500 }];
    const voucher = { id: randomUUID(), voucherNo: `${kind === 'sale' ? 'RV' : 'PV'}/${fy_label}/001`, type: kind === 'sale' ? 'receipt' : 'payment', date: d, lines,
      debitAccountId: lines[0].accountId, creditAccountId: lines[1].accountId, amount: 500, narration: `${kind === 'sale' ? 'Sale' : 'Purchase'}: Harness — ${provNo}`,
      createdAt: new Date().toISOString(), createdBy: 'Harness', refType: kind, refId: id };
    const event = buildEvent({ eventType: 'voucher.posted', tenantId: sid, aggregateType: 'voucher', aggregateId: voucher.id, sequence: 1,
      producer: { kind: 'human', id: 'Harness' }, payload: { lines: voucherPostingLines(voucher), ...voucherEventMeta(voucher) } },
      { eventId: randomUUID(), occurredAt: new Date().toISOString() });
    const document = { id, [kind === 'sale' ? 'saleNo' : 'purchaseNo']: provNo, date: d, [kind === 'sale' ? 'customerName' : 'supplierName']: 'Harness',
      items: [{ itemId: items[0].id, qty: 2, rate: 250, amount: 500 }], totalAmount: 500, discount: 0, netAmount: 500, grandTotal: 500, paymentMode: 'cash',
      createdAt: new Date().toISOString(), createdBy: 'Harness', taxAmount: 0 };
    const movements = [{ id: randomUUID(), date: d, itemId: items[0].id, type: kind, qty: 2, rate: 250, amount: 500, narration: 'Harness', createdAt: new Date().toISOString() }];
    return { kind, document: { ...document, ...over.document }, voucher: { ...voucher, ...over.voucher }, event, movements: over.movements ?? movements };
  };
  const post = (tx2, x) => { const p = buildStockDocumentPayload(x.kind, x.document, x.voucher, x.event, x.movements);
    return tx2.attempt('select public.post_stock_document($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb) as r',
      [p.p_kind, JSON.stringify(p.p_doc), JSON.stringify(p.p_voucher), JSON.stringify(p.p_lines), JSON.stringify(p.p_event), JSON.stringify(p.p_movements)]); };

  console.log('Sale');
  const before = await stock(items[0].id);
  const s1 = doc('sale');
  await asAdmin();
  let r = await post(tx, s1);
  ok('posts', r.ok && r.rows[0].r.status === 'posted', code(r));
  const res = r.ok ? r.rows[0].r : {};
  await tx.asOwner();
  const row = (await tx.query(`select "saleNo" no, "voucherId" vid, society_id::text s, "isDeleted" del from public.sales where id = $1`, [s1.document.id])).rows[0];
  const v = (await tx.query(`select "voucherNo" no, "refType" rt, "refId" ri, narration from public.vouchers where id = $1`, [s1.voucher.id])).rows[0];
  const mv = (await tx.query(`select "referenceNo" ref, qty::numeric q, society_id::text s from public.stock_movements where id = $1`, [s1.movements[0].id])).rows[0];
  const ev = (await tx.query(`select payload ->> 'voucherNo' vno, payload ->> 'narration' n from public.ledger_events where event_id = $1`, [s1.event.eventId])).rows[0];
  ok('sale row: official number, linked voucher, this society, live', row && row.no === res.docNo && row.vid === s1.voucher.id && row.s === sid && row.del === false, JSON.stringify(row));
  ok('number was re-issued by the server (the provisional /001 is taken in this backup)', res.docNo && res.docNo !== s1.document.saleNo, res.docNo);
  ok('voucher: official number, refType/refId, narration carries the OFFICIAL sale number', v && v.no === res.voucherNo && v.rt === 'sale' && v.ri === s1.document.id && v.narration.includes(res.docNo) && !v.narration.includes(s1.document.saleNo), JSON.stringify(v));
  ok('movement: referenceNo = the official sale number, this society', mv && mv.ref === res.docNo && Number(mv.q) === 2 && mv.s === sid, JSON.stringify(mv));
  ok('journal event meta carries the official voucher number and narration', ev && ev.vno === res.voucherNo && ev.n === v.narration);
  ok('currentStock −2 (floored at 0)', (await stock(items[0].id)) === Math.max(0, before - 2));
  ok('voucher_lines + entries written (via post_voucher)', Number((await tx.query(`select count(*) n from public.voucher_lines where voucher_id = $1`, [s1.voucher.id])).rows[0].n) === 2
    && Number((await tx.query(`select count(*) n from public.voucher_entries where "voucherId" = $1`, [s1.voucher.id])).rows[0].n) === 2);
  await asAdmin();
  r = await post(tx, s1);
  ok('same document again → exists, nothing duplicated', r.ok && r.rows[0].r.status === 'exists' && r.rows[0].r.docNo === res.docNo);

  console.log('Purchase');
  await tx.asOwner();
  const pb = await stock(items[0].id);
  const p1 = doc('purchase');
  await asAdmin();
  r = await post(tx, p1);
  ok('posts', r.ok && r.rows[0].r.status === 'posted', code(r));
  await tx.asOwner();
  const pr = (await tx.query(`select "purchaseNo" no from public.purchases where id = $1`, [p1.document.id])).rows[0];
  ok('purchase row + movement share the official number', pr && pr.no === r.rows[0].r.docNo
    && (await tx.query(`select "referenceNo" ref from public.stock_movements where id = $1`, [p1.movements[0].id])).rows[0].ref === pr.no);
  ok('currentStock +2 and purchaseRate = 250', (await stock(items[0].id)) === pb + 2
    && Number((await tx.query(`select "purchaseRate"::numeric r from public.stock_items where id = $1`, [items[0].id])).rows[0].r) === 250);

  console.log('Four-part voucher numbers already taken (the Rania pilot failure, fixed by 081)');
  const [{ taken, pfx, mx }] = (await tx.query(`select "voucherNo" taken, substring("voucherNo" from '^(.*)/[0-9]+$') pfx,
      (select max((substring(v2."voucherNo" from '/([0-9]+)$'))::bigint) from public.vouchers v2 where v2.society_id::text = $1
        and substring(v2."voucherNo" from '^(.*)/[0-9]+$') = substring(v."voucherNo" from '^(.*)/[0-9]+$')) mx
    from public.vouchers v where society_id::text = $1 and array_length(string_to_array("voucherNo", '/'), 1) = 4 and "voucherNo" like 'RV/%' limit 1`, [sid])).rows;
  const s4 = doc('sale', { voucher: { voucherNo: taken } });
  await asAdmin();
  r = await post(tx, s4);
  ok(`a taken 4-part voucher number (${taken}) → posts with the prefix's max + 1`, r.ok && r.rows[0].r.voucherNo === `${pfx}/${String(Number(mx) + 1).padStart(taken.split('/').pop().length, '0')}`,
    `${code(r)} ${r.ok ? r.rows[0].r.voucherNo : ''}`);
  const s5 = doc('sale', { voucher: { voucherNo: `${pfx}/99999999` } });
  r = await post(tx, s5);
  ok('a FREE 4-part provisional number is kept as is', r.ok && r.rows[0].r.voucherNo === `${pfx}/99999999`, `${code(r)} ${r.ok ? r.rows[0].r.voucherNo : ''}`);

  console.log('Refusals write nothing');
  const nothing = async (x) => {
    const a = await tx.query(`select count(*) n from public.sales where id = $1`, [x.document.id]);
    const b = await tx.query(`select count(*) n from public.purchases where id = $1`, [x.document.id]);
    const c = await tx.query(`select count(*) n from public.vouchers where id = $1`, [x.voucher.id]);
    const m = await tx.query(`select count(*) n from public.stock_movements where id = any($1)`, [x.movements.map((y) => y.id)]);
    return Number(a.rows[0].n) + Number(b.rows[0].n) + Number(c.rows[0].n) + Number(m.rows[0].n) === 0;
  };
  const refuse = async (label, x, want, as = asAdmin) => {
    await tx.asOwner(); const st = await stock(items[0].id);
    await as(); const rr = await post(tx, x);
    await tx.asOwner();
    ok(`${label} → ${want}, nothing written, stock unchanged`, !rr.ok && code(rr) === want && await nothing(x) && (await stock(items[0].id)) === st, code(rr));
  };
  await refuse('an item of another society', doc('sale', { movements: [{ id: randomUUID(), itemId: other_item, type: 'sale', qty: 1, rate: 1, amount: 1 }] }), 'unknown_item');
  await refuse('qty 0', doc('sale', { movements: [{ id: randomUUID(), itemId: items[0].id, type: 'sale', qty: 0, rate: 1, amount: 0 }] }), 'bad_movement_qty');
  await refuse('a purchase movement on a sale', doc('sale', { movements: [{ id: randomUUID(), itemId: items[0].id, type: 'purchase', qty: 1, rate: 1, amount: 1 }] }), 'movement_type_mismatch');
  await refuse('no items', doc('sale', { movements: [] }), 'no_items');
  await refuse('a date outside the open FY (post_voucher check)', doc('sale', { document: { date: `${Number(fy_start.slice(0, 4)) - 1}-06-01` }, voucher: { date: `${Number(fy_start.slice(0, 4)) - 1}-06-01` } }),
    'no_open_fy_for_date');
  await refuse('a viewer', doc('sale'), 'role_cannot_write', () => tx.as({ email: 's3f-viewer@harness.test', user_role: 'viewer' }));
  const bad = doc('sale'); bad.event.payload.lines[0].amountMinor += 1;
  await refuse('event legs differing from the voucher (post_voucher check)', bad, 'event_lines_differ');
  await tx.asOwner();
  await tx.query(`update public.society_settings set "fyLocked" = true where society_id::text = $1`, [sid]);
  await refuse('an FY-locked society', doc('purchase'), 'fy_locked');
  await tx.asOwner();
  await tx.query(`update public.society_settings set "fyLocked" = false where society_id::text = $1`, [sid]);
  await tx.asAnon();
  ok('anon cannot call it', !(await post(tx, doc('sale'))).ok);
});

console.log(`\nS3-f-1 post_stock_document: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
