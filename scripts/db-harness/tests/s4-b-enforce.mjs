#!/usr/bin/env node
// 105 · S4-b guard: for a posting-ON society a signed-in CLIENT cannot INSERT / UPDATE / DELETE vouchers,
// voucher_entries or ledger_events directly — it is refused LOUDLY (42501 post_voucher:direct_write_refused, never a
// silent 0-row no-op); the server posting functions still work; a posting-OFF society is unaffected; reads are
// unaffected. Precondition: harness up (latest dump) with 102–105 applied. Rolled back.
//
// Run: node scripts/db-harness/tests/s4-b-enforce.mjs

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
const { buildPostVoucherPayload, postVoucherErrorCode } = await imp('lib/ledger/postVoucherClient.ts');
const { voucherPostingLines, voucherEventMeta } = await imp('lib/ledger/voucherEvent.ts');
const { buildEvent } = await imp('lib/ledger/event.ts');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};
const code = (r) => (r.ok ? 'OK' : postVoucherErrorCode(r.error.message) ?? `${r.error.code} ${r.error.message}`);
const RANIA = 'd5e007f0-fef0-48dd-b5dc-7230ce0aa82c';

const SSK = 'd0dd474f-71db-4282-a4c3-ae7d0e02b2e2';
const refused = (r) => !r.ok && r.error?.code === '42501' && /direct_write_refused/.test(r.error?.message || '');

await inRollback(async (tx) => {
  const one = async (sql, p = []) => (await tx.query(sql, p)).rows[0];
  await tx.query(`insert into public.society_users (id, society_id, email, role, name, is_active) values
    (gen_random_uuid(), $1, 's4b-r@harness.test', 'admin', 'S4B Admin', true),
    (gen_random_uuid(), $2, 's4b-s@harness.test', 'admin', 'S4B SSK', true)`, [RANIA, SSK]);
  const [{ fy_start }] = (await tx.query(`select start_date::text fy_start from public.financial_years where status = 'open' and society_id = $1`, [RANIA])).rows;
  const d = fy_start.slice(0, 4) + '-06-13';
  const mk = (over = {}) => ({ id: randomUUID(), voucherNo: 'JV/S4B/' + Math.floor(Math.random() * 1e6), type: 'journal', date: d, debitAccountId: '5301', creditAccountId: '3301',
    amount: 100, narration: 'S4-b harness', origin: 'manual', createdAt: new Date().toISOString(), createdBy: 'Harness', ...over });
  const asR = () => tx.as({ email: 's4b-r@harness.test', user_role: 'admin' });
  const asS = () => tx.as({ email: 's4b-s@harness.test', user_role: 'admin' });
  const [{ id: vid }] = (await tx.query(`select id from public.vouchers where society_id = $1 and not coalesce("isDeleted", false) limit 1`, [RANIA])).rows;

  /* 1 · direct client writes in a posting-ON society are refused, loudly */
  await asR();
  ok('reads still work', (await tx.attempt(`select count(*) n from public.vouchers where society_id = $1`, [RANIA])).ok);
  ok('INSERT vouchers refused (42501 direct_write_refused)', refused(await tx.attempt(
    `insert into public.vouchers (id, society_id, "voucherNo", type, date, "debitAccountId", "creditAccountId", amount) values ($1, $2, 'X/1', 'journal', $3, '5301', '3301', 1)`, [randomUUID(), RANIA, d])));
  const up = await tx.attempt(`update public.vouchers set narration = narration where id = $1`, [vid]);
  ok('UPDATE vouchers refused — an error, NOT a silent 0-row success', refused(up), up.ok ? `ok rowCount=${up.rowCount}` : up.error?.message);
  ok('DELETE vouchers refused', refused(await tx.attempt(`delete from public.vouchers where id = $1`, [vid])));
  ok('INSERT voucher_entries refused', refused(await tx.attempt(`insert into public.voucher_entries (id, "voucherId", "accountId", dr, cr, society_id) values ($1, $2, '5301', 1, 0, $3)`, [randomUUID(), vid, RANIA])));
  ok('DELETE voucher_entries refused', refused(await tx.attempt(`delete from public.voucher_entries where "voucherId" = $1`, [vid])));
  ok('INSERT ledger_events refused', refused(await tx.attempt(
    `insert into public.ledger_events (event_id, event_type, schema_version, society_id, aggregate_type, aggregate_id, sequence, occurred_at, producer_kind, payload)
     values ($1, 'voucher.posted', 1, $2, 'voucher', $3, 99, now(), 'human', '{}'::jsonb)`, [randomUUID(), RANIA, randomUUID()])));

  /* 2 · the server paths still work */
  const v = mk();
  const ev = buildEvent({ eventType: 'voucher.posted', tenantId: RANIA, aggregateType: 'voucher', aggregateId: v.id, sequence: 1,
    producer: { kind: 'human', id: 'Harness' }, payload: { lines: voucherPostingLines(v), ...voucherEventMeta(v) } }, { eventId: randomUUID(), occurredAt: new Date().toISOString() });
  const p = buildPostVoucherPayload(v, ev);
  const posted = await tx.attempt('select public.post_voucher($1::jsonb, $2::jsonb, $3::jsonb) r', [JSON.stringify(p.p_voucher), JSON.stringify(p.p_lines), JSON.stringify(p.p_event)]);
  ok('post_voucher still posts', posted.ok, code(posted));
  ok('set_voucher_cleared still works', (await tx.attempt('select public.set_voucher_cleared($1, true, $2)', [v.id, d])).ok);
  ok('cancel_voucher still works', (await tx.attempt('select public.cancel_voucher($1, $2, $3)', [v.id, 'x', 'Harness'])).ok);
  const pv = mk({ approvalStatus: 'pending', voucherNo: 'JV/2026/27/001' });
  const legs = [{ id: 'a', accountId: '5301', drCr: 'Dr', amountMinor: 10000, narration: null }, { id: 'b', accountId: '3301', drCr: 'Cr', amountMinor: 10000, narration: null }];
  ok('save_pending_voucher still works', (await tx.attempt('select public.save_pending_voucher($1::jsonb, $2::jsonb)', [JSON.stringify(pv), JSON.stringify(legs)])).ok);
  ok('reject_voucher still works', (await tx.attempt('select public.reject_voucher($1, $2, $3)', [pv.id, 'no', 'S4B Admin'])).ok);

  /* 3 · a posting-OFF society is unaffected */
  await asS();
  const sv = (await tx.query(`select id from public.vouchers where society_id = $1 limit 1`, [SSK])).rows[0];
  if (sv) {
    const su = await tx.attempt(`update public.vouchers set narration = narration where id = $1`, [sv.id]);
    ok('posting-OFF society (SSK): direct UPDATE still allowed', su.ok && su.rowCount === 1, su.error?.message);
  } else ok('posting-OFF society (SSK): has a voucher to test', false);

  /* 4 · owner / service paths unaffected */
  await tx.asOwner();
  ok('the owner (migrations, fixtures) is not refused', (await tx.attempt(`update public.vouchers set narration = narration where id = $1`, [vid])).ok);
  ok('ledger_drift still 0', (await tx.query(`select * from public.ledger_drift($1)`, [RANIA])).rows.length === 0);
});

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
