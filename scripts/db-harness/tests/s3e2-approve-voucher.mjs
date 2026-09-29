#!/usr/bin/env node
// S3-e-2 · approve_voucher (migration 079) on the restored backup, as real JWT users.
// Precondition: harness up with 072–079 applied. Everything runs inside one rolled-back transaction.
// After an approval the journal, voucher_entries and the posted voucher_lines must each equal the
// voucher's legs; refusals must write nothing.
//
// Run: node scripts/db-harness/tests/s3e2-approve-voucher.mjs

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
const { buildEditVoucherPayload, postVoucherErrorCode } = await imp('lib/ledger/postVoucherClient.ts');
const { buildVoucherEntries } = await imp('lib/voucherUtils.ts');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};
const code = (r) => (r.ok ? 'OK' : postVoucherErrorCode(r.error.message) ?? `${r.error.code} ${r.error.message}`);
// Exactly what approveVoucher sends: the voucher's getVoucherLines legs.
const approve = (tx, v, by = 'Checker') => tx.attempt('select public.approve_voucher($1, $2::jsonb, $3) as r', [v.id, JSON.stringify(buildEditVoucherPayload(v).p_lines), by]);

async function state(tx, id) {
  const q = async (sql) => Object.fromEntries((await tx.query(sql, [id])).rows.filter((r) => Number(r.net) !== 0).map((r) => [r.acc, Number(r.net)]));
  return {
    journal: await q(`select l ->> 'accountId' acc, sum(case when l ->> 'drCr' = 'Dr' then 1 else -1 end * (l ->> 'amountMinor')::bigint) net
      from public.ledger_events e, jsonb_array_elements(e.payload -> 'lines') l where e.aggregate_id = $1 group by 1`),
    entries: await q(`select "accountId" acc, round(sum(dr - cr) * 100)::bigint net from public.voucher_entries where "voucherId" = $1 group by 1`),
    lines: await q(`select account_id acc, sum(dr_minor - cr_minor) net from public.voucher_lines where voucher_id = $1 and status = 'posted' group by 1`),
    evs: (await tx.query(`select event_type t, sequence s, producer_id p, payload from public.ledger_events where aggregate_id = $1 order by sequence`, [id])).rows,
    row: (await tx.query(`select "approvalStatus" st, "approvedBy" by from public.vouchers where id = $1`, [id])).rows[0],
  };
}
const same = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

await inRollback(async (tx) => {
  const [{ sid, fy_start }] = (await tx.query(`select society_id as sid, start_date::text as fy_start from public.financial_years where status = 'open' and society_id = 'd5e007f0-fef0-48dd-b5dc-7230ce0aa82c'`)).rows;
  for (const [email, role, name] of [['s3e-checker@harness.test', 'admin', 'Checker'], ['s3e-maker@harness.test', 'admin', 'Maker'], ['s3e-viewer@harness.test', 'viewer', 'Viewer']]) {
    await tx.query(`insert into public.society_users (id, society_id, email, role, name, is_active) values (gen_random_uuid(), $1, $2, $3, $4, true)`, [sid, email, role, name]);
  }
  const d = fy_start.slice(0, 4) + '-06-12';
  const asChecker = () => tx.as({ email: 's3e-checker@harness.test', user_role: 'admin' });
  // A pending voucher as addVoucher leaves it: the row + its entries (persistVoucher syncs entries), no journal event.
  const pending = async (over = {}) => {
    const v = { id: randomUUID(), voucherNo: 'JV/S3E/' + Math.floor(Math.random() * 1e6), type: 'journal', date: d, debitAccountId: '5301', creditAccountId: '3301',
      amount: 150, narration: 'S3-e pending', createdAt: new Date().toISOString(), createdBy: 'Maker', approvalStatus: 'pending', origin: 'manual', lines: null, ...over };
    await tx.asOwner();
    await tx.query(`insert into public.vouchers (id, society_id, "voucherNo", date, type, "debitAccountId", "creditAccountId", amount, narration, "isDeleted", "createdAt", "createdBy", "approvalStatus", origin, lines)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10, $11, $12, $13, $14)`,
      [v.id, sid, v.voucherNo, v.date, v.type, v.debitAccountId, v.creditAccountId, v.amount, v.narration, v.createdAt, v.createdBy, v.approvalStatus, v.origin, v.lines ? JSON.stringify(v.lines) : null]);
    for (const e of buildVoucherEntries(v, sid)) {
      await tx.query(`insert into public.voucher_entries (id, "voucherId", "accountId", dr, cr, society_id) values ($1, $2, $3, $4, $5, $6)`, [e.id, v.id, e.accountId, e.dr, e.cr, sid]);
    }
    return v;
  };
  const want = (v) => { const o = {}; for (const l of buildEditVoucherPayload(v).p_lines) o[l.accountId] = (o[l.accountId] ?? 0) + (l.drCr === 'Dr' ? 1 : -1) * l.amountMinor; return o; };

  console.log('Approve a pending voucher');
  const v1 = await pending();
  await asChecker();
  let r = await approve(tx, v1);
  ok('approve succeeds and returns the voucher.posted it wrote', r.ok && r.rows[0].r.status === 'approved' && r.rows[0].r.events.map((e) => e.event_type).join() === 'voucher.posted', code(r));
  await tx.asOwner();
  let s = await state(tx, v1.id);
  ok('row approved, approvedBy = the checker', s.row.st === 'approved' && s.row.by === 'Checker');
  ok('journal = entries = posted lines = the voucher legs', same(s.journal, want(v1)) && same(s.entries, want(v1)) && same(s.lines, want(v1)), JSON.stringify(s));
  ok('event: sequence 1, producer = checker, meta carries voucherNo + createdBy + ISO createdAt', s.evs.length === 1 && Number(s.evs[0].s) === 1 && s.evs[0].p === 'Checker'
    && s.evs[0].payload.voucherNo === v1.voucherNo && s.evs[0].payload.createdBy === 'Maker' && /Z$/.test(s.evs[0].payload.createdAt), JSON.stringify(s.evs[0]));
  await asChecker();
  r = await approve(tx, v1);
  ok('approve again → already_approved, nothing written', r.ok && r.rows[0].r.status === 'already_approved');
  await tx.asOwner();
  ok('still exactly one journal event', (await state(tx, v1.id)).evs.length === 1);

  console.log('Multi-line pending voucher');
  const v2 = await pending({ amount: 90, lines: [{ id: 'a', accountId: '5301', type: 'Dr', amount: 60 }, { id: 'b', accountId: '5202', type: 'Dr', amount: 30 }, { id: 'c', accountId: '3301', type: 'Cr', amount: 90 }] });
  await asChecker();
  ok('approves', (await approve(tx, v2)).ok);
  await tx.asOwner();
  s = await state(tx, v2.id);
  ok('3 legs consistent everywhere', same(s.journal, want(v2)) && same(s.entries, want(v2)) && same(s.lines, want(v2)), JSON.stringify(s));

  console.log('Maker ≠ checker');
  const v3 = await pending();
  await tx.as({ email: 's3e-maker@harness.test', user_role: 'admin' });
  ok('the maker (by JWT identity) cannot approve → self_approval', code(await approve(tx, v3, 'Someone Else')) === 'self_approval');
  await asChecker();
  ok('approver name equal to the maker → self_approval', code(await approve(tx, v3, 'maker ')) === 'self_approval');
  const v4 = await pending({ createdBy: 'System' });
  await tx.as({ email: 's3e-maker@harness.test', user_role: 'admin' });
  ok('a System-made voucher can be approved by anyone', (await approve(tx, v4, 'Maker')).ok);

  console.log('Refusals write nothing');
  const v5 = await pending();
  await tx.as({ email: 's3e-viewer@harness.test', user_role: 'viewer' });
  ok('viewer → role_cannot_write', code(await approve(tx, v5)) === 'role_cannot_write');
  await tx.as({ email: 's3e-checker@harness.test' });
  ok('no role claim → no_role_claim', code(await approve(tx, v5)) === 'no_role_claim');
  await asChecker();
  ok('legs not matching the stored voucher → legs_do_not_match_voucher', code(await tx.attempt('select public.approve_voucher($1, $2::jsonb, $3) as r', [v5.id,
    JSON.stringify([{ id: 'x', accountId: '5301', drCr: 'Dr', amountMinor: 999 }, { id: 'y', accountId: '3301', drCr: 'Cr', amountMinor: 999 }]), 'Checker'])) === 'legs_do_not_match_voucher');
  await tx.asOwner();
  s = await state(tx, v5.id);
  ok('after the refusals: still pending, no journal event', s.row.st === 'pending' && s.evs.length === 0);
  const v6 = await pending({ approvalStatus: 'rejected' });
  await asChecker();
  ok('rejected voucher → not_pending', code(await approve(tx, v6)) === 'not_pending');
  const v7 = await pending();
  await tx.asOwner(); await tx.query(`update public.vouchers set "isDeleted" = true where id = $1`, [v7.id]);
  await asChecker();
  ok('cancelled voucher → voucher_cancelled', code(await approve(tx, v7)) === 'voucher_cancelled');
  const v8 = await pending({ origin: 'engine' });
  await asChecker();
  ok('engine voucher → engine_voucher', code(await approve(tx, v8)) === 'engine_voucher');
  const v9 = await pending({ date: `${Number(fy_start.slice(0, 4)) - 1}-06-01` });
  await asChecker();
  ok('date outside the open FY → no_open_fy_for_date / period_locked', ['no_open_fy_for_date', 'period_locked'].includes(code(await approve(tx, v9))));
  const v10 = await pending();
  await tx.asOwner(); await tx.query(`update public.society_settings set "fyLocked" = true where society_id::text = $1`, [sid]);
  await asChecker();
  ok('FY-locked → fy_locked', code(await approve(tx, v10)) === 'fy_locked');
  await tx.asOwner(); await tx.query(`update public.society_settings set "fyLocked" = false, "periodLockDate" = $2 where society_id::text = $1`, [sid, d]);
  await asChecker();
  ok('inside the locked period → period_locked', code(await approve(tx, v10)) === 'period_locked');
  ok('unknown id → voucher_not_found', code(await approve(tx, { id: randomUUID(), amount: 1, debitAccountId: 'a', creditAccountId: 'b' })) === 'voucher_not_found');
  await tx.asAnon();
  ok('anon cannot call it', !(await approve(tx, v10)).ok);
});

console.log(`\nS3-e-2 approve_voucher: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
