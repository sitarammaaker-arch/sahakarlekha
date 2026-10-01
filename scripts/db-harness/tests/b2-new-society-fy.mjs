#!/usr/bin/env node
// Phase-2 B2 · migrations 088 + 089: a society registered through the real signup RPC gets its open
// financial_years row, so the server posting path can post for it; existing societies are untouched.
// Precondition: harness up (088 applied for the passing result). Everything runs in one rolled-back tx.
//
// Run: node scripts/db-harness/tests/b2-new-society-fy.mjs

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
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); } };

await inRollback(async (tx) => {
  const sid = randomUUID();
  const email = `b2-${sid.slice(0, 8)}@harness.test`;
  const before = Number((await tx.query('select count(*) n from public.financial_years')).rows[0].n);
  await tx.asAnon();   // signup runs before any login
  const r = await tx.attempt(`select public.register_society($1, $2, 'Passw0rd!', 'B2 Admin', $3::jsonb, $4::jsonb, $5::jsonb) as r`, [
    sid, email,
    // The same shapes Register.tsx sends.
    JSON.stringify({ id: sid, name: 'B2 Harness Society', name_hi: null, registration_no: `B2-${sid.slice(0, 8)}`, address: null, district: 'Sirsa', state: 'Haryana', phone: null, financial_year: '2026-27' }),
    JSON.stringify({ id: sid, society_id: sid, name: 'B2 Harness Society', nameHi: 'B2', registrationNo: `B2-${sid.slice(0, 8)}`, financialYear: '2026-27', financialYearStart: '2026-04-01',
      address: '', district: 'Sirsa', state: 'Haryana', phone: '', email, pinCode: '', societyType: 'cms' }),
    JSON.stringify([{ id: '3301', society_id: sid, name: 'Cash', type: 'asset' }, { id: '4407', society_id: sid, name: 'Admission Fee', type: 'income' }]),
  ]);
  ok('signup succeeds', r.ok && r.rows[0].r?.ok === true, r.ok ? JSON.stringify(r.rows[0].r) : r.error.message);
  await tx.asOwner();
  const fy = (await tx.query('select fy_label, start_date::text s, end_date::text e, status from public.financial_years where society_id = $1', [sid])).rows;
  ok('the new society has ONE open 2026-27 FY (1 Apr 2026 – 31 Mar 2027)', fy.length === 1 && fy[0].fy_label === '2026-27' && fy[0].s === '2026-04-01' && fy[0].e === '2027-03-31' && fy[0].status === 'open', JSON.stringify(fy));
  const flag = (await tx.query('select posting_service from public.society_flags where society_id::text = $1', [sid])).rows[0];
  ok('089: the new society starts with the posting service ON', flag?.posting_service === true, JSON.stringify(flag));
  ok('no other society gained an FY row', Number((await tx.query('select count(*) n from public.financial_years')).rows[0].n) === before + 1);

  // The admin can now post through the server.
  await tx.as({ email, user_role: 'admin' });
  const v = { id: randomUUID(), voucherNo: 'RV/2026/27/001', type: 'receipt', date: '2026-06-15', debitAccountId: '3301', creditAccountId: '4407', amount: 100, narration: 'B2 first voucher', createdAt: new Date().toISOString(), createdBy: 'B2 Admin', origin: 'manual' };
  // Exactly what addVoucher sends under the posting service.
  const ev = buildEvent({ eventType: 'voucher.posted', tenantId: sid, jurisdiction: '', aggregateType: 'voucher', aggregateId: v.id, sequence: 1,
    producer: { kind: 'human', id: 'B2 Admin' }, payload: { lines: voucherPostingLines(v), ...voucherEventMeta(v) } },
    { eventId: randomUUID(), occurredAt: new Date().toISOString() });
  const pl = buildPostVoucherPayload(v, ev);
  const p = await tx.attempt('select public.post_voucher($1::jsonb, $2::jsonb, $3::jsonb) as r', [JSON.stringify(pl.p_voucher), JSON.stringify(pl.p_lines), JSON.stringify(pl.p_event)]);
  ok('post_voucher works for the new society', p.ok && p.rows[0].r?.status === 'posted', p.ok ? JSON.stringify(p.rows[0].r) : p.error.message);

  // Existing society: a label change never adds or moves a year (rollover is Phase C).
  await tx.asOwner();
  const [{ old }] = (await tx.query(`select society_id::text old from public.society_settings where society_id::text <> $1 and "financialYear" = '2026-27' limit 1`, [sid])).rows;
  const fyOld = (await tx.query('select count(*) n from public.financial_years where society_id = $1', [old])).rows[0].n;
  await tx.query(`update public.society_settings set "financialYear" = '2027-28' where society_id::text = $1`, [old]);
  ok('an existing society\'s label change adds no FY row', (await tx.query('select count(*) n from public.financial_years where society_id = $1', [old])).rows[0].n === fyOld);
  await tx.query(`update public.society_settings set "financialYear" = 'not-a-year' where society_id::text = $1`, [sid]);
  ok('an invalid label is ignored (no error)', true);
});

console.log(`\nB2 new-society FY (088): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
