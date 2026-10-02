#!/usr/bin/env node
// S3-b · the app's OWN payload builder (src/lib/ledger/postVoucherClient.ts) against post_voucher on
// the restored backup, as a real JWT user. Uses a voucher shaped exactly like addVoucher's newVoucher
// (branchId, origin, lines, undefined overlays …) so a column/type mismatch between the Voucher type
// and the vouchers table shows up here, not in production. Every call is rolled back.
// Precondition: harness up with 072–077 applied.
//
// Run: node scripts/db-harness/tests/s3b-post-voucher-client.mjs

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
const { buildVoucherEntries } = await imp('lib/voucherUtils.ts');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};
// What addVoucher builds (shadowEvent) → what it sends.
const send = (tx, v, sid) => {
  const ev = buildEvent({ eventType: 'voucher.posted', tenantId: sid, jurisdiction: '', aggregateType: 'voucher', aggregateId: v.id, sequence: 1,
    producer: { kind: 'human', id: 'Harness User' }, payload: { lines: voucherPostingLines(v), ...voucherEventMeta(v) } },
    { eventId: randomUUID(), occurredAt: new Date().toISOString() });
  const p = buildPostVoucherPayload(v, ev);
  return tx.attempt('select public.post_voucher($1::jsonb, $2::jsonb, $3::jsonb) as r', [JSON.stringify(p.p_voucher), JSON.stringify(p.p_lines), JSON.stringify(p.p_event)]);
};
const code = (r) => (r.ok ? 'OK' : postVoucherErrorCode(r.error.message) ?? `${r.error.code} ${r.error.message}`);

await inRollback(async (tx) => {
  const [{ sid, fy_start }] = (await tx.query(`select society_id as sid, start_date::text as fy_start from public.financial_years where status = 'open' and society_id = 'd5e007f0-fef0-48dd-b5dc-7230ce0aa82c'`)).rows;
  const branch = (await tx.query(`select id from public.branches where society_id::text = $1 limit 1`, [sid]).catch(() => ({ rows: [] }))).rows[0]?.id;
  await tx.query(`insert into public.society_users (id, society_id, email, role, name, is_active) values (gen_random_uuid(), $1, 's3b@harness.test', 'accountant', 'db-harness', true)`, [sid]);
  const d = fy_start.slice(0, 4) + '-06-10';
  // Exactly the fields addVoucher's newVoucher carries (data spread + computed fields).
  const appVoucher = (over = {}) => ({
    type: 'receipt', date: d, narration: 'S3-b harness — नकद प्राप्ति', origin: 'manual', memberId: undefined,
    id: randomUUID(), voucherNo: 'RV/S3B/' + Math.floor(Math.random() * 1e6),
    lines: [{ id: 'l1', accountId: '3301', type: 'Dr', amount: 500.25, narration: '' }, { id: 'l2', accountId: '4407', type: 'Cr', amount: 500.25, narration: '' }],
    debitAccountId: '3301', creditAccountId: '4407', amount: 500.25, approvalStatus: undefined,
    branchId: branch, createdAt: new Date().toISOString(), createdBy: 'Harness User', ...over,
  });

  console.log('App-shaped voucher through the lib payload (accountant)');
  await tx.as({ email: 's3b@harness.test', user_role: 'accountant' });
  const v = appVoucher();
  const r = await send(tx, v, sid);
  ok('posts', r.ok && r.rows[0].r.status === 'posted', code(r));
  await tx.asOwner();
  const row = (await tx.query(`select "voucherNo", amount::numeric a, society_id::text s, "branchId" b, lines, origin from public.vouchers where id = $1`, [v.id])).rows[0];
  // 096: the server issues the official number inside post_voucher and returns it — the row carries THAT.
  ok('vouchers row carries the app fields (official no, amount, lines, branch, origin)', row && row.voucherNo === r.rows[0].r.voucherNo && Number(row.a) === 500.25
    && Array.isArray(row.lines) && row.lines.length === 2 && (row.b ?? undefined) === branch && row.origin === 'manual', JSON.stringify(row));
  // The entries the server wrote equal what the client path (buildVoucherEntries) would have written.
  const ents = (await tx.query(`select "accountId", dr::numeric dr, cr::numeric cr from public.voucher_entries where "voucherId" = $1 order by "accountId"`, [v.id])).rows
    .map((e) => `${e.accountId}:${Number(e.dr)}:${Number(e.cr)}`).join();
  const want = buildVoucherEntries(v, sid).map((e) => `${e.accountId}:${Number(e.dr)}:${Number(e.cr)}`).sort().join();
  ok('voucher_entries equal the client path\'s buildVoucherEntries', ents === want, `${ents} vs ${want}`);
  const evc = (await tx.query(`select count(*)::int n, max(producer_id) p from public.ledger_events where aggregate_id = $1`, [v.id])).rows[0];
  ok('one journal event, producer = the user', evc.n === 1 && evc.p === 'Harness User');

  console.log('Retry / collision');
  await tx.as({ email: 's3b@harness.test', user_role: 'accountant' });
  const again = await send(tx, v, sid);
  ok('the same voucher again (retry) → exists, no duplicate', again.ok && again.rows[0].r.status === 'exists');
  const dup = await send(tx, appVoucher({ voucherNo: v.voucherNo }), sid);
  const uniqueNo = (await tx.query(`select 1 from pg_indexes where tablename = 'vouchers' and indexdef ilike '%unique%' and indexdef ilike '%voucherNo%'`)).rowCount > 0;
  // 096: a taken provisional number no longer collides — the server issues the next free official one.
  if (uniqueNo) ok('a taken provisional number → posts with a different, free official number (no 23505)', dup.ok && dup.rows[0].r.voucherNo !== r.rows[0].r.voucherNo, code(dup));
  else ok('no unique index on voucherNo here — a repeated number posts (app renumber path unused)', dup.ok, code(dup));

  console.log('Legacy two-leg + a refusal surfaces a code the app maps to Hindi');
  const legacy = appVoucher({ lines: undefined, amount: 75 });
  ok('legacy voucher (no lines) posts', (await send(tx, legacy, sid)).ok);
  const locked = await send(tx, appVoucher({ date: `${Number(fy_start.slice(0, 4)) - 30}-06-01` }), sid);
  ok('an old date → a post_voucher:<code> the app can read', !locked.ok && ['period_locked', 'no_open_fy_for_date'].includes(postVoucherErrorCode(locked.error.message)), code(locked));
});

console.log(`\nS3-b post_voucher client (harness): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
