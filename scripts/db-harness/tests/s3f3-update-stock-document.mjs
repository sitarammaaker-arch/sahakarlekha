#!/usr/bin/env node
// S3-f-3 · update_stock_document (migration 083) on the restored backup, as real JWT users.
// Precondition: harness up with 072–083 applied. Everything runs inside one rolled-back transaction.
// An edited sale / purchase must end with: the OLD voucher cancelled (journal net 0), ONE new live voucher
// linked to the same document, only the new movements (same document number), stock = before − new qty,
// the row updated in place (same id / number / createdAt) — or, on refusal, nothing changed.
//
// Run: node scripts/db-harness/tests/s3f3-update-stock-document.mjs

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
  const [item] = (await tx.query(`select id, "salesAccountId" sa, "purchaseAccountId" pa from public.stock_items where society_id::text = $1 order by id limit 1`, [sid])).rows;
  for (const [email, role] of [['s3f3-admin@harness.test', 'admin'], ['s3f3-acct@harness.test', 'accountant'], ['s3f3-viewer@harness.test', 'viewer']]) {
    await tx.query(`insert into public.society_users (id, society_id, email, role, name, is_active) values (gen_random_uuid(), $1, $2, $3, 'Harness', true)`, [sid, email, role]);
  }
  const asAdmin = () => tx.as({ email: 's3f3-admin@harness.test', user_role: 'admin' });
  const asAcct = () => tx.as({ email: 's3f3-acct@harness.test', user_role: 'accountant' });
  const d = fy_start.slice(0, 4) + '-06-16';
  const stock = async () => Number((await tx.query(`select "currentStock"::numeric cs from public.stock_items where id = $1`, [item.id])).rows[0].cs);

  // What addSale/updateSale build: a voucher (as addVoucher would), its event, the document, the movements.
  const build = (kind, qty, over = {}) => {
    const amt = qty * 100;
    const acc = kind === 'sale' ? (item.sa || '4101') : (item.pa || '5101');
    const lines = kind === 'sale' ? [{ id: 'a', accountId: '3301', type: 'Dr', amount: amt }, { id: 'b', accountId: acc, type: 'Cr', amount: amt }]
      : [{ id: 'a', accountId: acc, type: 'Dr', amount: amt }, { id: 'b', accountId: '3301', type: 'Cr', amount: amt }];
    const date = over.date ?? d;
    const voucher = { id: randomUUID(), voucherNo: `${kind === 'sale' ? 'RV' : 'PV'}/${fy_label}/001`, type: kind === 'sale' ? 'receipt' : 'payment', date, lines,
      debitAccountId: lines[0].accountId, creditAccountId: lines[1].accountId, amount: amt, narration: 'S3-f-3', createdAt: new Date().toISOString(), createdBy: 'Harness' };
    const event = buildEvent({ eventType: 'voucher.posted', tenantId: sid, aggregateType: 'voucher', aggregateId: voucher.id, sequence: 1, producer: { kind: 'human', id: 'Harness' },
      payload: { lines: voucherPostingLines(voucher), ...voucherEventMeta(voucher) } }, { eventId: randomUUID(), occurredAt: new Date().toISOString() });
    const doc = { [kind === 'sale' ? 'saleNo' : 'purchaseNo']: `${kind === 'sale' ? 'SL' : 'PUR'}/${fy_label}/001`, date, items: [{ itemId: item.id, qty, rate: 100, amount: amt }],
      totalAmount: amt, netAmount: amt, grandTotal: amt, paymentMode: 'cash', narration: over.narration ?? 'first', createdAt: new Date().toISOString(), createdBy: 'Harness' };
    const movements = [{ id: randomUUID(), date, itemId: item.id, type: kind, qty, rate: 100, amount: amt, narration: 'S3-f-3' }];
    return { voucher, event, doc, movements };
  };
  const postNew = async (kind, qty) => {
    const x = build(kind, qty); const id = randomUUID();
    const p = buildStockDocumentPayload(kind, { ...x.doc, id }, x.voucher, x.event, x.movements);
    await asAdmin();
    const r = await tx.attempt('select public.post_stock_document($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb) as r',
      [p.p_kind, JSON.stringify(p.p_doc), JSON.stringify(p.p_voucher), JSON.stringify(p.p_lines), JSON.stringify(p.p_event), JSON.stringify(p.p_movements)]);
    if (!r.ok) throw new Error('post failed: ' + code(r));
    await tx.asOwner();
    return { kind, id, voucherId: x.voucher.id, docNo: r.rows[0].r.docNo };
  };
  const update = (kind, id, qty, over = {}) => {
    const x = build(kind, qty, over);
    const p = buildStockDocumentPayload(kind, { ...x.doc, id }, x.voucher, x.event, x.movements);
    return { x, run: () => tx.attempt('select public.update_stock_document($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9) as r',
      [kind, id, JSON.stringify(p.p_doc), JSON.stringify(p.p_voucher), JSON.stringify(p.p_lines), JSON.stringify(p.p_event), JSON.stringify(p.p_movements), null, 'Harness']) };
  };
  const q1 = async (sql, p) => (await tx.query(sql, p)).rows[0];
  const jnet = async (vid) => Number((await q1(`select coalesce(sum(case when l ->> 'drCr' = 'Dr' then 1 else -1 end * (l ->> 'amountMinor')::bigint), 0) n
    from public.ledger_events e, jsonb_array_elements(e.payload -> 'lines') l where e.aggregate_id = $1 and l ->> 'accountId' = '3301'`, [vid])).n);

  console.log('Edit a sale (qty 3 → 5) as an ACCOUNTANT (write role only)');
  const s0 = await stock();
  const s = await postNew('sale', 3);
  const created = (await q1(`select "createdAt"::text c from public.sales where id = $1`, [s.id])).c;
  const u = update('sale', s.id, 5, { narration: 'edited' });
  await asAcct();
  let r = await u.run();
  ok('edit succeeds', r.ok && r.rows[0].r.status === 'updated', code(r));
  await tx.asOwner();
  const row = await q1(`select "saleNo" no, "voucherId" vid, "createdAt"::text c, narration n, "isDeleted" del, (items -> 0 ->> 'qty')::int q from public.sales where id = $1`, [s.id]);
  ok('row updated IN PLACE: same number + createdAt, new voucherId, new fields, still live', row.no === s.docNo && row.c === created && row.vid === u.x.voucher.id && row.n === 'edited' && row.q === 5 && row.del === false, JSON.stringify(row));
  const oldV = await q1(`select "isDeleted" d from public.vouchers where id = $1`, [s.voucherId]);
  const newV = await q1(`select "isDeleted" d, "refType" rt, "refId" ri, amount::numeric a from public.vouchers where id = $1`, [u.x.voucher.id]);
  ok('old voucher cancelled, journal net 0 (voucher.cancelled returned)', oldV.d === true && (await jnet(s.voucherId)) === 0 && r.rows[0].r.events.some((e) => e.event_type === 'voucher.cancelled' && e.aggregate_id === s.voucherId));
  ok('new voucher live, linked to the SAME sale, ₹500, journal +50000', newV.d === false && newV.rt === 'sale' && newV.ri === s.id && Number(newV.a) === 500 && (await jnet(u.x.voucher.id)) === 50000);
  const mv = (await tx.query(`select id, qty::int q from public.stock_movements where society_id::text = $1 and "referenceNo" = $2`, [sid, s.docNo])).rows;
  ok('only the NEW movement remains, under the same sale number', mv.length === 1 && mv[0].id === u.x.movements[0].id && mv[0].q === 5, JSON.stringify(mv));
  ok('stock = before − 5 (old 3 restored, new 5 taken)', (await stock()) === Math.max(0, Math.max(0, s0 - 3) + 3 - 5));

  console.log('Edit it again (5 → 2)');
  const u2 = update('sale', s.id, 2);
  await asAdmin();
  r = await u2.run();
  await tx.asOwner();
  ok('second edit: previous voucher cancelled, newest live, one movement of 2', r.ok && (await q1(`select "isDeleted" d from public.vouchers where id = $1`, [u.x.voucher.id])).d === true
    && (await q1(`select "voucherId" v from public.sales where id = $1`, [s.id])).v === u2.x.voucher.id
    && Number((await q1(`select count(*) n from public.stock_movements where society_id::text = $1 and "referenceNo" = $2`, [sid, s.docNo])).n) === 1, code(r));

  console.log('Edit a purchase');
  const p0 = await stock();
  const p = await postNew('purchase', 4);
  const up = update('purchase', p.id, 6);
  await asAdmin();
  r = await up.run();
  await tx.asOwner();
  ok('purchase: stock = before + 6, old voucher cancelled, new live', r.ok && (await stock()) === p0 + 6
    && (await q1(`select "isDeleted" d from public.vouchers where id = $1`, [p.voucherId])).d === true
    && (await q1(`select "isDeleted" d from public.vouchers where id = $1`, [up.x.voucher.id])).d === false, code(r));

  console.log('Refusals change nothing');
  const unchanged = async (label, x, run, want, as) => {
    await tx.asOwner();
    const st = await stock();
    const before = await q1(`select "voucherId" v from public.sales where id = $1`, [x.id]);
    await as(); const rr = await run();
    await tx.asOwner();
    const now = await q1(`select "voucherId" v from public.sales where id = $1`, [x.id]);
    const oldLive = (await q1(`select "isDeleted" d from public.vouchers where id = $1`, [before.v])).d === false;
    const movs = Number((await q1(`select count(*) n from public.stock_movements where society_id::text = $1 and "referenceNo" = $2`, [sid, x.docNo])).n);
    ok(`${label} → ${want}; voucher link, old voucher, movements and stock unchanged`, !rr.ok && code(rr) === want && now.v === before.v && oldLive && movs === 1 && (await stock()) === st,
      `${code(rr)} link:${now.v === before.v} live:${oldLive} movs:${movs}`);
  };
  const t1 = await postNew('sale', 1);
  await unchanged('a viewer', t1, update('sale', t1.id, 2).run, 'role_cannot_write', () => tx.as({ email: 's3f3-viewer@harness.test', user_role: 'viewer' }));
  await unchanged('a new date outside the open FY (post_voucher check)', t1, update('sale', t1.id, 2, { date: `${Number(fy_start.slice(0, 4)) - 1}-06-01` }).run, 'no_open_fy_for_date', asAdmin);
  const bad = update('sale', t1.id, 2); bad.x.movements[0].qty = 0;
  const badRun = () => { const pp = buildStockDocumentPayload('sale', { ...bad.x.doc, id: t1.id }, bad.x.voucher, bad.x.event, bad.x.movements);
    return tx.attempt('select public.update_stock_document($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9) as r',
      ['sale', t1.id, JSON.stringify(pp.p_doc), JSON.stringify(pp.p_voucher), JSON.stringify(pp.p_lines), JSON.stringify(pp.p_event), JSON.stringify(pp.p_movements), null, 'H']); };
  await unchanged('a zero-qty new movement', t1, badRun, 'bad_movement_qty', asAdmin);
  await tx.asOwner(); await tx.query(`update public.society_settings set "periodLockDate" = $2 where society_id::text = $1`, [sid, d]);
  await unchanged('the old date inside the locked period', t1, update('sale', t1.id, 2).run, 'period_locked', asAdmin);
  await tx.asOwner(); await tx.query(`update public.society_settings set "periodLockDate" = null where society_id::text = $1`, [sid]);
  await asAdmin();
  await tx.attempt('select public.cancel_stock_document($1, $2, $3, $4) as r', ['sale', t1.id, 'x', 'H']);
  ok('a deleted document → document_cancelled', code(await update('sale', t1.id, 2).run()) === 'document_cancelled');

  console.log('cancel_voucher still refuses a write-only role (now via the core)');
  const t2 = await postNew('sale', 1);
  await asAcct();
  ok('accountant cancel_voucher → role_cannot_delete', code(await tx.attempt('select public.cancel_voucher($1, $2, $3) as r', [t2.voucherId, 'x', 'H'])) === 'role_cannot_delete');
  await tx.asAnon();
  ok('anon cannot call update_stock_document', !(await update('sale', t2.id, 2).run()).ok);
});

console.log(`\nS3-f-3 update_stock_document: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
