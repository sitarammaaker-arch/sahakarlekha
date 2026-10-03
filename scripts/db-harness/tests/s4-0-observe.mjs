#!/usr/bin/env node
// 102 · S4-0 observer: a signed-in CLIENT write to vouchers / voucher_entries / ledger_events in a posting-ON society
// leaves one error_log row (source s4-direct-write) per statement, and the write itself still succeeds; the
// posting functions (post_voucher, cancel_voucher) leave none; a posting-OFF society leaves none; anon cannot
// call posting_service_on. Precondition: harness up (latest dump) with 102 applied. Rolled back.
//
// Run: node scripts/db-harness/tests/s4-0-observe.mjs

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
const { buildPostVoucherPayload } = await imp('lib/ledger/postVoucherClient.ts');
const { voucherPostingLines, voucherEventMeta } = await imp('lib/ledger/voucherEvent.ts');
const { buildEvent } = await imp('lib/ledger/event.ts');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};

const RANIA = 'd5e007f0-fef0-48dd-b5dc-7230ce0aa82c';   // posting ON
const SSK = 'd0dd474f-71db-4282-a4c3-ae7d0e02b2e2';     // posting OFF

await inRollback(async (tx) => {
  const notes = async () => (await tx.query(`select society_id, message, context from public.error_log where source = 's4-direct-write' order by created_at, id`)).rows;
  const before = (await notes()).length;
  // Once 105 (S4-b) is applied, direct writes are refused before the observer can see them. Test the observer
  // in isolation: drop the guard inside this rolled-back transaction (the real one is untouched).
  for (const t of ['vouchers', 'voucher_entries', 'ledger_events']) await tx.query(`drop trigger if exists s4_refuse_direct_write on public.${t}`);
  const flags = (await tx.query(`select society_id, posting_service from public.society_flags where society_id in ($1, $2)`, [RANIA, SSK])).rows;
  ok('fixture: Rania ON, SSK OFF', flags.find((f) => f.society_id === RANIA)?.posting_service === true && !flags.find((f) => f.society_id === SSK)?.posting_service);

  for (const [sid, email] of [[RANIA, 's40-r@harness.test'], [SSK, 's40-s@harness.test']]) {
    await tx.query(`insert into public.society_users (id, society_id, email, role, name, is_active) values (gen_random_uuid(), $1, $2, 'admin', 'db-harness', true)`, [sid, email]);
  }
  const [{ fy_start }] = (await tx.query(`select start_date::text fy_start from public.financial_years where status = 'open' and society_id = $1`, [RANIA])).rows;
  const d = fy_start.slice(0, 4) + '-06-11';
  const mk = (over = {}) => ({ id: randomUUID(), voucherNo: 'JV/S40/' + Math.floor(Math.random() * 1e6), type: 'journal', date: d, debitAccountId: '5301', creditAccountId: '3301',
    amount: 100, narration: 'S4-0 harness', origin: 'manual', createdAt: new Date().toISOString(), createdBy: 'Harness', ...over });

  // 1 · the server path leaves no note
  await tx.as({ email: 's40-r@harness.test', user_role: 'admin' });
  const v = mk();
  const ev = buildEvent({ eventType: 'voucher.posted', tenantId: RANIA, aggregateType: 'voucher', aggregateId: v.id, sequence: 1,
    producer: { kind: 'human', id: 'Harness' }, payload: { lines: voucherPostingLines(v), ...voucherEventMeta(v) } }, { eventId: randomUUID(), occurredAt: new Date().toISOString() });
  const p = buildPostVoucherPayload(v, ev);
  const posted = await tx.attempt('select public.post_voucher($1::jsonb, $2::jsonb, $3::jsonb) as r', [JSON.stringify(p.p_voucher), JSON.stringify(p.p_lines), JSON.stringify(p.p_event)]);
  ok('post_voucher succeeds', posted.ok, posted.error?.message);
  const cancelled = await tx.attempt('select public.cancel_voucher($1, $2, $3) as r', [v.id, 'harness', 'Harness']);
  ok('cancel_voucher succeeds', cancelled.ok, cancelled.error?.message);
  await tx.asOwner();
  ok('server posting + cancel leave NO s4 note', (await notes()).length === before, String((await notes()).length - before));

  // 2 · direct client writes in a posting-ON society: each succeeds AND leaves exactly one note
  await tx.as({ email: 's40-r@harness.test', user_role: 'admin' });
  const [{ id: someV }] = (await tx.query(`select id from public.vouchers where society_id = $1 and not coalesce("isDeleted", false) limit 1`, [RANIA])).rows;
  const u = await tx.attempt(`update public.vouchers set "isCleared" = coalesce("isCleared", false) where id = $1`, [someV]);
  ok('direct UPDATE on vouchers still succeeds (observe only)', u.ok && u.rowCount === 1, u.error?.message);
  const d2 = await tx.attempt(`delete from public.voucher_entries where "voucherId" = $1`, [someV]);
  ok('direct DELETE on voucher_entries still succeeds', d2.ok, d2.error?.message);
  await tx.asOwner();
  const n2 = (await notes()).slice(before);
  ok('…and leaves one note per statement', n2.length === 2, JSON.stringify(n2.map((x) => x.message)));
  ok('…naming the table and the operation', n2.some((x) => x.message === 'vouchers UPDATE') && n2.some((x) => x.message === 'voucher_entries DELETE'));
  ok('…stamped with the society', n2.every((x) => x.society_id === RANIA));
  ok('…counting the rows', n2.find((x) => x.message === 'vouchers UPDATE')?.context?.rows === 1);

  // 3 · a posting-OFF society is not observed
  await tx.as({ email: 's40-s@harness.test', user_role: 'admin' });
  const sv = (await tx.query(`select id from public.vouchers where society_id = $1 limit 1`, [SSK])).rows[0];
  if (sv) await tx.attempt(`update public.vouchers set "isCleared" = coalesce("isCleared", false) where id = $1`, [sv.id]);
  await tx.asOwner();
  ok('a posting-OFF society leaves no note', (await notes()).slice(before).every((x) => x.society_id !== SSK));

  // 4 · a broken logger never breaks the user's write (the observer swallows its own failures)
  await tx.query(`create or replace function public._s4_note_direct_write(p_society_id text, p_table text, p_op text, p_rows integer)
    returns void language plpgsql security definer set search_path = public as $f$ begin raise exception 'logger down'; end $f$`);
  await tx.as({ email: 's40-r@harness.test', user_role: 'admin' });
  const u3 = await tx.attempt(`update public.vouchers set "isCleared" = coalesce("isCleared", false) where id = $1`, [someV]);
  ok('logger failing ⇒ the write still succeeds', u3.ok && u3.rowCount === 1, u3.error?.message);
  await tx.asOwner();

  // 4 · grants
  await tx.asAnon();
  const anon = await tx.attempt(`select public.posting_service_on($1)`, [RANIA]);
  ok('anon cannot call posting_service_on', !anon.ok && anon.error?.code === '42501', anon.error?.code);
});

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
