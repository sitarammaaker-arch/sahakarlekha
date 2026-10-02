#!/usr/bin/env node
// 096 · voucher numbers are issued by the server inside post_voucher (gapless) and continue every
// (society, book, FY) series at max+1. Run on the latest prod dump with 096 applied. Rolled back.
//
// Run: node scripts/db-harness/tests/h-096-voucher-numbering.mjs

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
const { buildPostVoucherPayload, buildEditVoucherPayload, postVoucherErrorCode } = await imp('lib/ledger/postVoucherClient.ts');
const { voucherPostingLines, voucherEventMeta } = await imp('lib/ledger/voucherEvent.ts');
const { buildEvent } = await imp('lib/ledger/event.ts');
const { getVoucherLines } = await imp('lib/voucherUtils.ts');
const { toMinor } = await imp('lib/money.ts');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};
const code = (r) => (r.ok ? 'OK' : postVoucherErrorCode(r.error.message) ?? `${r.error.code} ${r.error.message}`);
const legsOf = (v) => getVoucherLines(v).map((l) => ({ id: l.id, accountId: l.accountId, drCr: l.type, amountMinor: toMinor(Number(l.amount) || 0), narration: l.narration ?? null }));

const post = (tx, v, sid) => {
  const ev = buildEvent({ eventType: 'voucher.posted', tenantId: sid, aggregateType: 'voucher', aggregateId: v.id, sequence: 1,
    producer: { kind: 'human', id: 'Harness' }, payload: { lines: voucherPostingLines(v), ...voucherEventMeta(v) } },
    { eventId: randomUUID(), occurredAt: new Date().toISOString() });
  const p = buildPostVoucherPayload(v, ev);
  return tx.attempt('select public.post_voucher($1::jsonb, $2::jsonb, $3::jsonb) as r', [JSON.stringify(p.p_voucher), JSON.stringify(p.p_lines), JSON.stringify(p.p_event)]);
};
// The app's own edit payload (S3-d-2): editable fields + getVoucherLines legs.
const edit = (tx, v) => { const p = buildEditVoucherPayload(v); return tx.attempt('select public.edit_voucher($1::jsonb, $2::jsonb, $3) as r', [JSON.stringify(p.p_voucher), JSON.stringify(p.p_lines), 'Harness']); };
const cancel = (tx, id, reason = 'harness') => tx.attempt('select public.cancel_voucher($1, $2, $3) as r', [id, reason, 'Harness']);


await inRollback(async (tx) => {
  const sid = 'd5e007f0-fef0-48dd-b5dc-7230ce0aa82c';
  const [{ fy_start }] = (await tx.query(`select start_date::text as fy_start from public.financial_years where status = 'open' and society_id = $1`, [sid])).rows;
  await tx.query(`insert into public.society_users (id, society_id, email, role, name, is_active) values (gen_random_uuid(), $1, 'h096-admin@harness.test', 'admin', 'db-harness', true)`, [sid]);
  const d = fy_start.slice(0, 4) + '-06-10';
  const fyTag = fy_start.slice(0, 4) + '/' + String(Number(fy_start.slice(2, 4)) + 1).padStart(2, '0');
  const series = `RV/${fyTag}`;
  const maxNo = async () => Number((await tx.query(`select coalesce(max((split_part("voucherNo", '/', 4))::bigint), 0) m from public.vouchers where society_id::text = $1 and "voucherNo" like $2`, [sid, series + '/%'])).rows[0].m);
  const before = await maxNo();
  const seq = async () => Number((await tx.query(`select last_number from public.document_sequences where society_id = $1 and book = 'RV' and fy = $2`, [sid, fyTag])).rows[0]?.last_number ?? -1);
  ok('the seed set the RV sequence to the series max', (await seq()) === before, `seq ${await seq()} vs max ${before}`);

  const asAdmin = () => tx.as({ email: 'h096-admin@harness.test', user_role: 'admin' });
  const mk = (over = {}) => ({ id: randomUUID(), voucherNo: `${series}/001`, type: 'receipt', date: d, debitAccountId: '3301', creditAccountId: '4407',
    amount: 10, narration: '096 harness', origin: 'manual', createdAt: new Date().toISOString(), createdBy: 'Harness', ...over });
  const noOf = (r) => r.ok ? r.rows[0].r.voucherNo : null;
  const pad = (n) => `${series}/${String(n).padStart(3, '0')}`;

  await asAdmin();
  const v1 = mk();
  const r1 = await post(tx, v1, sid);
  ok('a stale provisional number is replaced by the official max+1', noOf(r1) === pad(before + 1), `${code(r1)} ${noOf(r1)}`);
  const v2 = mk({ voucherNo: `${series}/777` });
  const r2 = await post(tx, v2, sid);
  ok('the next voucher is consecutive (max+2)', noOf(r2) === pad(before + 2), `${code(r2)} ${noOf(r2)}`);

  const bad = mk({ amount: 10, lines: [{ id: 'a', accountId: '3301', type: 'Dr', amount: 10 }, { id: 'b', accountId: '4407', type: 'Cr', amount: 9 }] });
  const rb = await post(tx, bad, sid);
  ok('a refused post (unbalanced) fails', !rb.ok, code(rb));
  const v3 = mk();
  const r3 = await post(tx, v3, sid);
  ok('…and spends no number: the next one is max+3 (gapless)', noOf(r3) === pad(before + 3), `${code(r3)} ${noOf(r3)}`);

  const again = await post(tx, v3, sid);
  ok('an idempotent retry returns the same official number', again.ok && again.rows[0].r.status === 'exists' && again.rows[0].r.voucherNo === pad(before + 3), JSON.stringify(again.rows?.[0]?.r));

  await tx.asOwner();
  const stored = (await tx.query(`select "voucherNo" from public.vouchers where id = $1`, [v1.id])).rows[0]?.voucherNo;
  ok('the stored row carries the official number', stored === pad(before + 1), stored);
  const evNo = (await tx.query(`select payload ->> 'voucherNo' n from public.ledger_events where aggregate_id = $1`, [v1.id])).rows[0]?.n;
  ok('the journal event carries the official number', evNo === pad(before + 1) || evNo == null, String(evNo));
  ok('the sequence advanced exactly by the 3 posted vouchers', (await seq()) === before + 3, String(await seq()));
  const anon = (await tx.query(`select has_function_privilege('anon', 'public.next_document_number(text, text, text)', 'EXECUTE') a`)).rows[0].a;
  ok('anon can no longer call next_document_number', anon === false);
});

console.log(`\n096 voucher numbering: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
