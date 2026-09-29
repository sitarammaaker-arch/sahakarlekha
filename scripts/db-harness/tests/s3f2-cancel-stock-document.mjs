#!/usr/bin/env node
// S3-f-2 · cancel_stock_document (migration 082) on the restored backup, as real JWT users.
// Precondition: harness up with 072–082 applied. Everything runs inside one rolled-back transaction.
// A deleted sale / purchase must leave: row isDeleted, every linked voucher cancelled WITH its journal
// (net zero), no entries, no posted lines, no movements, stock restored — or, on refusal, nothing changed.
//
// Run: node scripts/db-harness/tests/s3f2-cancel-stock-document.mjs

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
  for (const [email, role] of [['s3f2-admin@harness.test', 'admin'], ['s3f2-acct@harness.test', 'accountant']]) {
    await tx.query(`insert into public.society_users (id, society_id, email, role, name, is_active) values (gen_random_uuid(), $1, $2, $3, 'Harness', true)`, [sid, email, role]);
  }
  const asAdmin = () => tx.as({ email: 's3f2-admin@harness.test', user_role: 'admin' });
  const d = fy_start.slice(0, 4) + '-06-15';
  const stock = async () => Number((await tx.query(`select "currentStock"::numeric cs from public.stock_items where id = $1`, [item.id])).rows[0].cs);

  const post = async (kind) => {
    const id = randomUUID();
    const acc = kind === 'sale' ? (item.sa || '4101') : (item.pa || '5101');
    const lines = kind === 'sale' ? [{ id: 'a', accountId: '3301', type: 'Dr', amount: 300 }, { id: 'b', accountId: acc, type: 'Cr', amount: 300 }]
      : [{ id: 'a', accountId: acc, type: 'Dr', amount: 300 }, { id: 'b', accountId: '3301', type: 'Cr', amount: 300 }];
    const voucher = { id: randomUUID(), voucherNo: `${kind === 'sale' ? 'RV' : 'PV'}/${fy_label}/001`, type: kind === 'sale' ? 'receipt' : 'payment', date: d, lines,
      debitAccountId: lines[0].accountId, creditAccountId: lines[1].accountId, amount: 300, narration: 'S3-f-2', createdAt: new Date().toISOString(), createdBy: 'Harness' };
    const event = buildEvent({ eventType: 'voucher.posted', tenantId: sid, aggregateType: 'voucher', aggregateId: voucher.id, sequence: 1, producer: { kind: 'human', id: 'Harness' },
      payload: { lines: voucherPostingLines(voucher), ...voucherEventMeta(voucher) } }, { eventId: randomUUID(), occurredAt: new Date().toISOString() });
    const doc = { id, [kind === 'sale' ? 'saleNo' : 'purchaseNo']: `${kind === 'sale' ? 'SL' : 'PUR'}/${fy_label}/001`, date: d, items: [{ itemId: item.id, qty: 3, rate: 100, amount: 300 }],
      totalAmount: 300, netAmount: 300, grandTotal: 300, paymentMode: 'cash', createdAt: new Date().toISOString(), createdBy: 'Harness' };
    const movements = [{ id: randomUUID(), date: d, itemId: item.id, type: kind, qty: 3, rate: 100, amount: 300, narration: 'S3-f-2' }];
    const p = buildStockDocumentPayload(kind, doc, voucher, event, movements);
    await asAdmin();
    const r = await tx.attempt('select public.post_stock_document($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb) as r',
      [p.p_kind, JSON.stringify(p.p_doc), JSON.stringify(p.p_voucher), JSON.stringify(p.p_lines), JSON.stringify(p.p_event), JSON.stringify(p.p_movements)]);
    if (!r.ok) throw new Error('post failed: ' + code(r));
    await tx.asOwner();
    return { kind, id, voucherId: voucher.id, docNo: r.rows[0].r.docNo };
  };
  const cancel = (x, reason = 'harness') => tx.attempt('select public.cancel_stock_document($1, $2, $3, $4) as r', [x.kind, x.id, reason, 'Harness']);
  const after = async (x) => {
    const t = x.kind === 'sale' ? 'sales' : 'purchases';
    const q1 = async (sql, p) => (await tx.query(sql, p)).rows[0];
    return {
      del: (await q1(`select "isDeleted" d from public.${t} where id = $1`, [x.id])).d,
      vdel: (await q1(`select "isDeleted" d from public.vouchers where id = $1`, [x.voucherId])).d,
      journal: Number((await q1(`select coalesce(sum(case when l ->> 'drCr' = 'Dr' then 1 else -1 end * (l ->> 'amountMinor')::bigint), 0) n
        from public.ledger_events e, jsonb_array_elements(e.payload -> 'lines') l where e.aggregate_id = $1 and l ->> 'accountId' = '3301'`, [x.voucherId])).n),
      cancelled: Number((await q1(`select count(*) n from public.ledger_events where aggregate_id = $1 and event_type = 'voucher.cancelled'`, [x.voucherId])).n),
      entries: Number((await q1(`select count(*) n from public.voucher_entries where "voucherId" = $1`, [x.voucherId])).n),
      lines: Number((await q1(`select count(*) n from public.voucher_lines where voucher_id = $1 and status = 'posted'`, [x.voucherId])).n),
      mv: Number((await q1(`select count(*) n from public.stock_movements where society_id::text = $1 and "referenceNo" = $2`, [sid, x.docNo])).n),
    };
  };

  console.log('Delete a sale posted through post_stock_document');
  const s0 = await stock();
  const s = await post('sale');
  ok('posted: stock −3', (await stock()) === Math.max(0, s0 - 3));
  await asAdmin();
  let r = await cancel(s, 'Sale deleted');
  ok('cancel succeeds, returns the voucher.cancelled and 1 movement removed', r.ok && r.rows[0].r.status === 'cancelled' && r.rows[0].r.events.length === 1
    && r.rows[0].r.events[0].event_type === 'voucher.cancelled' && r.rows[0].r.movementsDeleted === 1, code(r));
  await tx.asOwner();
  let a = await after(s);
  ok('row isDeleted, voucher cancelled, journal nets to 0, no entries / posted lines / movements', a.del === true && a.vdel === true && a.journal === 0 && a.cancelled === 1
    && a.entries === 0 && a.lines === 0 && a.mv === 0, JSON.stringify(a));
  ok('stock restored (+3 from the movements)', (await stock()) === Math.max(0, s0 - 3) + 3);
  await asAdmin();
  r = await cancel(s);
  ok('delete again → already_cancelled, nothing changes', r.ok && r.rows[0].r.status === 'already_cancelled');

  console.log('Delete a purchase');
  await tx.asOwner();
  const p0 = await stock();
  const p = await post('purchase');
  await asAdmin();
  r = await cancel(p, 'Purchase deleted');
  await tx.asOwner();
  a = await after(p);
  ok('purchase: cancelled everywhere, stock back to where it was', r.ok && a.del && a.vdel && a.journal === 0 && a.mv === 0 && (await stock()) === p0, `${code(r)} ${JSON.stringify(a)}`);

  console.log('A sale from the backup (posted by the old client path)');
  const old = (await tx.query(`select s.id, s."saleNo" no, s."voucherId" vid from public.sales s join public.vouchers v on v.id = s."voucherId"
      where s.society_id::text = $1 and not coalesce(s."isDeleted", false) and not coalesce(v."isDeleted", false) and v."reversedBy" is null
        and coalesce(v.origin, '') <> 'engine' and substr(s.date, 1, 10)::date >= $2::date limit 1`, [sid, fy_start])).rows[0];
  if (old) {
    await asAdmin();
    r = await cancel({ kind: 'sale', id: old.id });
    await tx.asOwner();
    a = await after({ kind: 'sale', id: old.id, voucherId: old.vid, docNo: old.no });
    ok(`existing sale ${old.no}: row + voucher cancelled, journal 0, movements gone`, r.ok && a.del && a.vdel && a.journal === 0 && a.mv === 0, `${code(r)} ${JSON.stringify(a)}`);
  } else ok('(no live sale in the open FY in this backup — skipped)', true);

  console.log('Refusals change nothing');
  const unchanged = async (x, want, as) => {
    await tx.asOwner(); const st = await stock();
    await as(); const rr = await cancel(x);
    await tx.asOwner(); const aa = await after(x);
    ok(`→ ${want}; row + voucher live, movements kept, stock unchanged`, !rr.ok && code(rr) === want && aa.del === false && aa.vdel === false && aa.mv === 1 && (await stock()) === st, `${code(rr)} ${JSON.stringify(aa)}`);
  };
  const x1 = await post('sale');
  process.stdout.write('  accountant');
  await unchanged(x1, 'role_cannot_delete', () => tx.as({ email: 's3f2-acct@harness.test', user_role: 'accountant' }));
  await tx.asOwner(); await tx.query(`update public.society_settings set "periodLockDate" = $2 where society_id::text = $1`, [sid, d]);
  process.stdout.write('  locked period');
  await unchanged(x1, 'period_locked', asAdmin);
  await tx.asOwner(); await tx.query(`update public.society_settings set "periodLockDate" = null, "fyLocked" = true where society_id::text = $1`, [sid]);
  process.stdout.write('  FY-locked');
  await unchanged(x1, 'fy_locked', asAdmin);
  await tx.asOwner(); await tx.query(`update public.society_settings set "fyLocked" = false where society_id::text = $1`, [sid]);
  await tx.query(`update public.vouchers set "reversedBy" = 'x' where id = $1`, [x1.voucherId]);
  process.stdout.write('  reversed voucher');
  await unchanged(x1, 'voucher_reversed', asAdmin);
  await asAdmin();
  ok('unknown id → document_not_found', code(await cancel({ kind: 'sale', id: randomUUID() })) === 'document_not_found');
  ok('bad kind → bad_kind', code(await cancel({ kind: 'loan', id: x1.id })) === 'bad_kind');
  await tx.asAnon();
  ok('anon cannot call it', !(await cancel(x1)).ok);
});

console.log(`\nS3-f-2 cancel_stock_document: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
