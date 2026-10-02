#!/usr/bin/env node
// 095 · edit_voucher refuses a REVERSAL voucher (reversalOf set) as well as a reversed one; a plain
// voucher still edits. Prod 2026-07-16: a reversal's amount was edited 2,00,000 → 2,50,000, leaving the
// pair ₹50,000 apart in cash. Precondition: harness up (latest dump) with 095 applied. Rolled back.
//
// Run: node scripts/db-harness/tests/h-reversal-edit-lock.mjs

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
  const [{ sid, fy_start }] = (await tx.query(`select society_id as sid, start_date::text as fy_start from public.financial_years where status = 'open' and society_id = 'd5e007f0-fef0-48dd-b5dc-7230ce0aa82c'`)).rows;
  await tx.query(`insert into public.society_users (id, society_id, email, role, name, is_active) values (gen_random_uuid(), $1, 'h095-admin@harness.test', 'admin', 'db-harness', true)`, [sid]);
  const d = fy_start.slice(0, 4) + '-06-10';
  const asAdmin = () => tx.as({ email: 'h095-admin@harness.test', user_role: 'admin' });
  const mk = (over = {}) => ({ id: randomUUID(), voucherNo: 'JV/H095/' + Math.floor(Math.random() * 1e6), type: 'journal', date: d, debitAccountId: '5301', creditAccountId: '3301',
    amount: 100, narration: '095 harness', origin: 'manual', createdAt: new Date().toISOString(), createdBy: 'Harness', ...over });

  await asAdmin();
  const orig = mk();
  ok('original posts', (await post(tx, orig, sid)).ok);
  const rev = mk({ debitAccountId: '3301', creditAccountId: '5301', narration: 'Reversal of 095 harness' });
  ok('reversal posts', (await post(tx, rev, sid)).ok);
  await tx.asOwner();
  await tx.query(`update public.vouchers set "reversalOf" = $1 where id = $2`, [orig.id, rev.id]);
  await tx.query(`update public.vouchers set "reversedBy" = $1 where id = $2`, [rev.id, orig.id]);
  await asAdmin();

  const r1 = await edit(tx, { ...rev, amount: 250, lines: [{ id: 'a', accountId: '3301', type: 'Dr', amount: 250 }, { id: 'b', accountId: '5301', type: 'Cr', amount: 250 }] });
  ok('editing the REVERSAL is refused (voucher_is_reversal)', code(r1) === 'voucher_is_reversal', code(r1));
  const r2 = await edit(tx, { ...orig, amount: 250, lines: [{ id: 'a', accountId: '5301', type: 'Dr', amount: 250 }, { id: 'b', accountId: '3301', type: 'Cr', amount: 250 }] });
  ok('editing the REVERSED original is still refused (voucher_reversed)', code(r2) === 'voucher_reversed', code(r2));
  const plain = mk();
  ok('a plain voucher posts', (await post(tx, plain, sid)).ok);
  const r3 = await edit(tx, { ...plain, amount: 150, lines: [{ id: 'a', accountId: '5301', type: 'Dr', amount: 150 }, { id: 'b', accountId: '3301', type: 'Cr', amount: 150 }] });
  ok('a plain voucher still edits', r3.ok, code(r3));
  await tx.asOwner();
  const amt = (await tx.query(`select amount::numeric a from public.vouchers where id = $1`, [rev.id])).rows[0].a;
  ok('the reversal is unchanged', Number(amt) === 100, String(amt));
});

console.log(`
095 reversal edit lock: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
