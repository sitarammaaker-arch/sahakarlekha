#!/usr/bin/env node
// S3-a · post_voucher (migration 077) on the restored backup, called as real JWT users.
// Precondition: harness up with 072–077 applied. Every call runs inside a rolled-back transaction.
// Builds the payload with the app's OWN builders (getVoucherLines / voucherPostingLines /
// voucherEventMeta / buildEvent) — exactly what the wired app will send.
//
// Run: node scripts/db-harness/tests/s3a-post-voucher.mjs

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
const { getVoucherLines } = await imp('lib/voucherUtils.ts');
const { toMinor } = await imp('lib/money.ts');
const { voucherPostingLines, voucherEventMeta } = await imp('lib/ledger/voucherEvent.ts');
const { buildEvent } = await imp('lib/ledger/event.ts');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};

/** The exact payload the wired app will send for a voucher. */
function payloadFor(v, sid) {
  const legs = getVoucherLines(v).map((l) => ({ id: l.id, accountId: l.accountId, drCr: l.type, amountMinor: toMinor(Number(l.amount) || 0), narration: l.narration ?? null }));
  const ev = buildEvent({ eventType: 'voucher.posted', tenantId: sid, aggregateType: 'voucher', aggregateId: v.id, sequence: 1,
    producer: { kind: 'human', id: 'harness' }, payload: { lines: voucherPostingLines(v), ...voucherEventMeta(v) } },
    { eventId: randomUUID(), occurredAt: new Date().toISOString() });
  const event = { event_id: ev.eventId, event_type: ev.eventType, schema_version: ev.schemaVersion, aggregate_type: 'voucher', aggregate_id: v.id,
    sequence: 1, occurred_at: ev.occurredAt, producer_kind: ev.producer.kind, producer_id: ev.producer.id, on_behalf_of: null, payload: ev.payload };
  return [v, legs, event];
}
const call = (tx, [v, legs, ev]) => tx.attempt('select public.post_voucher($1::jsonb, $2::jsonb, $3::jsonb) as r', [JSON.stringify(v), JSON.stringify(legs), JSON.stringify(ev)]);
const code = (r) => (r.ok ? 'OK' : (String(r.error.message).match(/post_voucher:(\w+)/) || [, r.error.message])[1]);

await inRollback(async (tx) => {
  const [{ sid, fy_start }] = (await tx.query(`select society_id as sid, start_date::text as fy_start from public.financial_years where status = 'open' and society_id = 'd5e007f0-fef0-48dd-b5dc-7230ce0aa82c'`)).rows;
  const [{ other }] = (await tx.query(`select society_id::text as other from public.society_settings where society_id::text <> $1 limit 1`, [sid])).rows;
  const otherOnly = (await tx.query(`select b.id from public.accounts b where b.society_id::text = $1 and not exists (select 1 from public.accounts a where a.society_id::text = $2 and a.id = b.id) limit 1`, [other, sid])).rows[0]?.id;
  for (const [email, role] of [['s3-admin@harness.test', 'admin'], ['s3-viewer@harness.test', 'viewer']]) {
    await tx.query(`insert into public.society_users (id, society_id, email, role, name, is_active) values (gen_random_uuid(), $1, $2, $3, 'db-harness', true)`, [sid, email, role]);
  }
  const d = fy_start.slice(0, 4) + '-05-15';
  const base = (over = {}) => ({ id: randomUUID(), voucherNo: 'JV/S3/' + Math.floor(Math.random() * 1e6), type: 'journal', date: d,
    debitAccountId: '5201', creditAccountId: '3301', amount: 1234.5, narration: 'S3-a harness', createdAt: new Date().toISOString(), createdBy: 'harness', ...over });

  console.log('Happy path (admin)');
  await tx.as({ email: 's3-admin@harness.test', user_role: 'admin' });
  const v1 = base();
  const r1 = await call(tx, payloadFor(v1, sid));
  ok('legacy two-leg voucher posts', r1.ok && r1.rows[0].r.status === 'posted', code(r1));
  await tx.asOwner();
  const rows = (await tx.query(`select
      (select count(*)::int from public.vouchers where id = $1 and society_id::text = $2 and not "isDeleted") v,
      (select count(*)::int from public.voucher_lines where voucher_id = $1 and source = 'post_voucher') l,
      (select sum(dr_minor)::bigint from public.voucher_lines where voucher_id = $1) dr,
      (select sum(cr_minor)::bigint from public.voucher_lines where voucher_id = $1) cr,
      (select count(*)::int from public.voucher_entries where "voucherId" = $1) e,
      (select sum(dr)::numeric from public.voucher_entries where "voucherId" = $1) edr,
      (select count(*)::int from public.ledger_events where aggregate_id = $1 and event_type = 'voucher.posted' and society_id = $2) ev,
      (select count(*)::int from public.voucher_lines l join public.financial_years f on f.id = l.fy_id where l.voucher_id = $1 and f.status = 'open') infy`, [v1.id, sid])).rows[0];
  ok('one vouchers row, stamped with the JWT society', rows.v === 1);
  ok('2 voucher_lines, balanced, 123450 paise each side, in the open FY', rows.l === 2 && Number(rows.dr) === 123450 && Number(rows.cr) === 123450 && rows.infy === 2);
  ok('2 voucher_entries (₹1234.50 Dr)', rows.e === 2 && Number(rows.edr) === 1234.5);
  ok('1 voucher.posted journal event', rows.ev === 1);

  await tx.as({ email: 's3-admin@harness.test', user_role: 'admin' });
  const again = await call(tx, payloadFor(v1, sid));
  ok('same voucher id again → "exists", nothing duplicated', again.ok && again.rows[0].r.status === 'exists');
  const multi = base({ debitAccountId: undefined, creditAccountId: undefined, amount: 300,
    lines: [{ id: 'a', accountId: '5201', type: 'Dr', amount: 200 }, { id: 'b', accountId: '5202', type: 'Dr', amount: 100 }, { id: 'c', accountId: '3301', type: 'Cr', amount: 300 }] });
  ok('multi-line voucher posts', (await call(tx, payloadFor(multi, sid))).ok);

  console.log('Refusals');
  const refuses = async (label, payload, want) => { const r = await call(tx, payload); ok(`${label} → ${want}`, !r.ok && code(r) === want, code(r)); };
  await refuses('unbalanced legs', (() => { const p = payloadFor(base(), sid); p[1][1].amountMinor -= 1; return p; })(), 'unbalanced');
  await refuses('legs not matching the voucher total', (() => { const p = payloadFor(base(), sid); p[1][0].amountMinor += 100; p[1][1].amountMinor += 100; p[2].payload.lines[0].amountMinor += 100; p[2].payload.lines[1].amountMinor += 100; return p; })(), 'legs_do_not_match_voucher');
  await refuses('event lines differing from the legs', (() => { const p = payloadFor(base(), sid); p[2].payload.lines[0].accountId = '5202'; return p; })(), 'event_lines_differ');
  // The year before the open FY: after any period lock, but in no OPEN financial year (closed history or none).
  await refuses('a date outside any open FY', payloadFor(base({ date: `${Number(fy_start.slice(0, 4)) - 1}-06-01` }), sid), 'no_open_fy_for_date');
  await refuses('a pending voucher', payloadFor(base({ approvalStatus: 'pending' }), sid), 'pending_not_supported');
  await refuses('a single leg', (() => { const p = payloadFor(base(), sid); p[1] = p[1].slice(0, 1); p[2].payload.lines = p[2].payload.lines.slice(0, 1); return p; })(), 'too_few_legs');
  if (otherOnly) {
    const r = await call(tx, payloadFor(base({ debitAccountId: otherOnly }), sid));
    ok("an account of another society → refused (FK)", !r.ok && /voucher_lines_account_fkey|foreign key/i.test(String(r.error.message)), code(r));
  }
  await tx.query(`update public.society_settings set "periodLockDate" = $2 where society_id::text = $1`, [sid, d]).catch(() => {});
  await tx.asOwner();
  await tx.query(`update public.society_settings set "periodLockDate" = $2 where society_id::text = $1`, [sid, d]);
  await tx.as({ email: 's3-admin@harness.test', user_role: 'admin' });
  await refuses('a date inside the locked period', payloadFor(base(), sid), 'period_locked');
  await tx.asOwner();
  await tx.query(`update public.society_settings set "periodLockDate" = null, "fyLocked" = true where society_id::text = $1`, [sid]);
  await tx.as({ email: 's3-admin@harness.test', user_role: 'admin' });
  await refuses('an FY-locked society', payloadFor(base(), sid), 'fy_locked');
  await tx.asOwner();
  await tx.query(`update public.society_settings set "fyLocked" = false where society_id::text = $1`, [sid]);

  await tx.as({ email: 's3-viewer@harness.test', user_role: 'viewer' });
  await refuses('a viewer', payloadFor(base(), sid), 'role_cannot_write');
  await tx.as({ email: 's3-admin@harness.test' });
  await refuses('no role claim (fail-closed)', payloadFor(base(), sid), 'no_role_claim');
  await tx.asAnon();
  const anon = await call(tx, payloadFor(base(), sid));
  ok('anon cannot call it', !anon.ok);

  console.log('Tenant from the JWT, never the payload');
  await tx.as({ email: 's3-admin@harness.test', user_role: 'admin' });
  const spoof = base({ society_id: other });
  const rs = await call(tx, payloadFor(spoof, sid));
  await tx.asOwner();
  const landed = (await tx.query('select society_id::text as s from public.vouchers where id = $1', [spoof.id])).rows[0]?.s;
  ok('a society_id in the payload is ignored — the row lands in the caller\'s society', rs.ok && landed === sid, `${code(rs)} ${landed}`);
});

console.log(`\nS3-a post_voucher: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
