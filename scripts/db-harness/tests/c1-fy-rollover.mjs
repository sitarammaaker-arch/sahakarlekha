#!/usr/bin/env node
// Phase-2 C · migration 090 (founder decision (अ)): rollover on the server. When a society's label moves to
// the next year, the open year becomes 'closing' (still postable) and the next year opens. Exercised on the
// real Bacher shape (open 2025-26, entering 2026-27 vouchers) on the restored backup, as a JWT admin.
// Precondition: harness up with 088 + 090 applied. Everything runs in one rolled-back transaction.
//
// Run: node scripts/db-harness/tests/c1-fy-rollover.mjs

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
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); } };
const code = (r) => (r.ok ? 'OK' : postVoucherErrorCode(r.error.message) ?? r.error.message.split(' — ')[0]);

await inRollback(async (tx) => {
  // A society on an ended year: open FY = 2025-26 (Bacher's shape). Pick it by shape, not by id.
  const [{ sid }] = (await tx.query(`select f.society_id sid from public.financial_years f join public.society_settings s on s.society_id::text = f.society_id
     where f.status = 'open' and f.fy_label = '2025-26' and s."financialYear" = '2025-26'
       and not exists (select 1 from public.financial_years g where g.society_id = f.society_id and g.status = 'closing')
     order by (select count(*) from public.vouchers v where v.society_id::text = f.society_id) desc limit 1`)).rows;
  ok('fixture: a society whose open year is 2025-26', !!sid);
  const email = 'c1-admin@harness.test';
  await tx.query(`insert into public.society_users (id, society_id, email, role, name, is_active) values (gen_random_uuid(), $1, $2, 'admin', 'C1 Admin', true)`, [sid, email]);
  const accs = (await tx.query(`select id from public.accounts where society_id::text = $1 and id in ('3301', '4407', '5301', '1102') order by id`, [sid])).rows.map((r) => r.id);
  const [dr, cr] = accs.includes('5301') && accs.includes('3301') ? ['5301', '3301'] : [accs[0], accs[1]];
  const asAdmin = () => tx.as({ email, user_role: 'admin' });
  const years = async () => { await tx.asOwner(); return Object.fromEntries((await tx.query('select fy_label, status from public.financial_years where society_id = $1', [sid])).rows.map((r) => [r.fy_label, r.status])); };
  const post = async (date) => {
    await asAdmin();
    const v = { id: randomUUID(), voucherNo: `JV/C1/${Math.floor(Math.random() * 1e7)}`, type: 'journal', date, debitAccountId: dr, creditAccountId: cr, amount: 10,
      narration: 'C1 rollover test', createdAt: new Date().toISOString(), createdBy: 'C1 Admin', origin: 'manual' };
    const ev = buildEvent({ eventType: 'voucher.posted', tenantId: sid, jurisdiction: '', aggregateType: 'voucher', aggregateId: v.id, sequence: 1,
      producer: { kind: 'human', id: 'C1 Admin' }, payload: { lines: voucherPostingLines(v), ...voucherEventMeta(v) } }, { eventId: randomUUID(), occurredAt: new Date().toISOString() });
    const p = buildPostVoucherPayload(v, ev);
    const r = await tx.attempt('select public.post_voucher($1::jsonb, $2::jsonb, $3::jsonb) as r', [JSON.stringify(p.p_voucher), JSON.stringify(p.p_lines), JSON.stringify(p.p_event)]);
    return { r, v };
  };
  const setLabel = async (lbl) => { await asAdmin(); return tx.attempt(`update public.society_settings set "financialYear" = $2 where society_id::text = $1`, [sid, lbl]); };
  const fyOfLines = async (vid) => { await tx.asOwner(); return (await tx.query('select distinct f.fy_label from public.voucher_lines l join public.financial_years f on f.id = l.fy_id where l.voucher_id = $1', [vid])).rows.map((r) => r.fy_label).join(); };

  console.log('Before rollover');
  ok('a 2026-27 voucher is refused (no open year for its date)', code((await post('2026-06-01')).r) === 'no_open_fy_for_date');

  console.log('Rollover 2025-26 → 2026-27 (the app\'s "start new year" changes the label)');
  ok('the admin\'s settings save succeeds', (await setLabel('2026-27')).ok);
  let y = await years();
  ok('2025-26 is now closing, 2026-27 open', y['2025-26'] === 'closing' && y['2026-27'] === 'open', JSON.stringify(y));
  await tx.asOwner();
  ok('the new year links to the previous one', (await tx.query(`select count(*)::int n from public.financial_years n join public.financial_years p on p.id = n.previous_fy_id where n.society_id = $1 and n.fy_label = '2026-27' and p.fy_label = '2025-26'`, [sid])).rows[0].n === 1);

  console.log('Posting after rollover (decision अ)');
  let { r, v } = await post('2026-06-01');
  ok('a 2026-27 voucher posts, its lines in FY 2026-27', r.ok && (await fyOfLines(v.id)) === '2026-27', code(r));
  ({ r, v } = await post('2026-03-15'));
  ok('a late 2025-26 voucher still posts into the CLOSING year', r.ok && (await fyOfLines(v.id)) === '2025-26', code(r));
  await asAdmin();
  const c = await tx.attempt('select public.cancel_voucher($1, $2, $3) as r', [v.id, 'c1 test', 'C1 Admin']);
  ok('a voucher in the closing year can be cancelled', c.ok, c.ok ? '' : c.error.message);

  console.log('Guards');
  ok('re-saving the same label changes nothing', (await setLabel('2026-27')).ok && JSON.stringify(await years()) === JSON.stringify(y));
  let j = await setLabel('2028-29');
  ok('a jump of two years is refused (not_next) and changes nothing', !j.ok && /fy_rollover:not_next/.test(j.error.message) && JSON.stringify(await years()) === JSON.stringify(y), j.ok ? 'accepted' : '');
  j = await setLabel('2027-28');
  ok('the next rollover is refused while 2025-26 is still closing', !j.ok && /previous_still_closing/.test(j.error.message) && JSON.stringify(await years()) === JSON.stringify(y));
  ok('going back to a year the society has (2025-26) changes no year', (await setLabel('2025-26')).ok && JSON.stringify(await years()) === JSON.stringify(y));
  ok('an invalid label is ignored', (await setLabel('abc')).ok && JSON.stringify(await years()) === JSON.stringify(y));
});

console.log(`\nC1 FY rollover (090): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
