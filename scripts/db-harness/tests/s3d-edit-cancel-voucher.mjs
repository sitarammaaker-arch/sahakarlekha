#!/usr/bin/env node
// S3-d-1 · edit_voucher / cancel_voucher (migration 078) on the restored backup, as real JWT users.
// Precondition: harness up with 072–078 applied. Everything runs inside one rolled-back transaction.
// After every step the journal (Σ legs of ALL events), voucher_entries and the posted voucher_lines
// must each equal the voucher's current legs — the invariant the old multi-call save broke.
//
// Run: node scripts/db-harness/tests/s3d-edit-cancel-voucher.mjs

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

/** Per-account net (paise) of: the journal, voucher_entries, posted voucher_lines — and the voucher's own legs. */
async function state(tx, id) {
  const q = async (sql) => Object.fromEntries((await tx.query(sql, [id])).rows.filter((r) => Number(r.net) !== 0).map((r) => [r.acc, Number(r.net)]));
  const journal = await q(`select l ->> 'accountId' acc, sum(case when l ->> 'drCr' = 'Dr' then 1 else -1 end * (l ->> 'amountMinor')::bigint) net
    from public.ledger_events e, jsonb_array_elements(e.payload -> 'lines') l where e.aggregate_id = $1 group by 1`);
  const entries = await q(`select "accountId" acc, round(sum(dr - cr) * 100)::bigint net from public.voucher_entries where "voucherId" = $1 group by 1`);
  const lines = await q(`select account_id acc, sum(dr_minor - cr_minor) net from public.voucher_lines where voucher_id = $1 and status = 'posted' group by 1`);
  const evs = (await tx.query(`select event_type t, sequence s, reversal_of r, event_id id from public.ledger_events where aggregate_id = $1 order by sequence`, [id])).rows;
  const row = (await tx.query(`select "isDeleted" del, amount::numeric amt, narration from public.vouchers where id = $1`, [id])).rows[0];
  return { journal, entries, lines, evs, row };
}
const netOf = (v) => { const o = {}; for (const l of legsOf(v)) o[l.accountId] = (o[l.accountId] ?? 0) + (l.drCr === 'Dr' ? 1 : -1) * l.amountMinor; for (const k of Object.keys(o)) if (!o[k]) delete o[k]; return o; };
const same = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
const consistent = (s, want) => same(s.journal, want) && same(s.entries, want) && same(s.lines, want);
const show = (s) => JSON.stringify({ j: s.journal, e: s.entries, l: s.lines });

await inRollback(async (tx) => {
  const [{ sid, fy_start }] = (await tx.query(`select society_id as sid, start_date::text as fy_start from public.financial_years where status = 'open' and society_id = 'd5e007f0-fef0-48dd-b5dc-7230ce0aa82c'`)).rows;
  for (const [email, role] of [['s3d-admin@harness.test', 'admin'], ['s3d-acct@harness.test', 'accountant'], ['s3d-viewer@harness.test', 'viewer']]) {
    await tx.query(`insert into public.society_users (id, society_id, email, role, name, is_active) values (gen_random_uuid(), $1, $2, $3, 'db-harness', true)`, [sid, email, role]);
  }
  const d = fy_start.slice(0, 4) + '-06-10';
  const asAdmin = () => tx.as({ email: 's3d-admin@harness.test', user_role: 'admin' });
  const mk = (over = {}) => ({ id: randomUUID(), voucherNo: 'JV/S3D/' + Math.floor(Math.random() * 1e6), type: 'journal', date: d, debitAccountId: '5301', creditAccountId: '3301',
    amount: 100, narration: 'S3-d harness', origin: 'manual', createdAt: new Date().toISOString(), createdBy: 'Harness', ...over });

  console.log('Edit a voucher posted through post_voucher');
  await asAdmin();
  let v = mk();
  ok('posts', (await post(tx, v, sid)).ok);
  v = { ...v, amount: 250, lines: [{ id: 'n1', accountId: '5301', type: 'Dr', amount: 250 }, { id: 'n2', accountId: '3301', type: 'Cr', amount: 250 }] };
  let r = await edit(tx, v);
  ok('edit (amount + new line ids) succeeds', r.ok && r.rows[0].r.status === 'edited', code(r));
  ok('returns the two events it wrote', r.ok && r.rows[0].r.events.map((e) => e.event_type).join() === 'voucher.reversed,voucher.reposted');
  await tx.asOwner();
  let s = await state(tx, v.id);
  ok('journal = entries = posted lines = the new legs (no stale entries)', consistent(s, netOf(v)), show(s));
  ok('sequence 1,2,3; reversed points at the posting', s.evs.map((e) => e.s).join() === '1,2,3' && s.evs[1].r === s.evs[0].id);

  console.log('Second edit, then a postings-neutral edit');
  await asAdmin();
  v = { ...v, amount: 40, lines: [{ id: 'm1', accountId: '5301', type: 'Dr', amount: 25 }, { id: 'm2', accountId: '5202', type: 'Dr', amount: 15 }, { id: 'm3', accountId: '3301', type: 'Cr', amount: 40 }] };
  ok('second edit (3 legs) succeeds', (await edit(tx, v)).ok);
  await tx.asOwner();
  s = await state(tx, v.id);
  ok('still consistent after the second edit', consistent(s, netOf(v)), show(s));
  ok('sequence 4,5; second reversal points at the FIRST repost', s.evs.map((e) => e.s).join() === '1,2,3,4,5' && s.evs[3].r === s.evs[2].id);
  await asAdmin();
  r = await edit(tx, { ...v, narration: 'सिर्फ़ विवरण बदला' });
  await tx.asOwner();
  s = await state(tx, v.id);
  ok('narration-only edit → no new event, row updated, still consistent', r.ok && s.evs.length === 5 && s.row.narration === 'सिर्फ़ विवरण बदला' && consistent(s, netOf(v)), code(r));

  console.log('Cancel');
  await asAdmin();
  r = await cancel(tx, v.id, 'गलत entry');
  ok('cancel succeeds and returns voucher.cancelled', r.ok && r.rows[0].r.status === 'cancelled' && r.rows[0].r.events[0]?.event_type === 'voucher.cancelled', code(r));
  await tx.asOwner();
  s = await state(tx, v.id);
  ok('journal nets to zero, entries gone, no posted lines, row isDeleted', consistent(s, {}) && s.row.del === true, show(s));
  ok('cancel reverses the LATEST repost', s.evs[5].t === 'voucher.cancelled' && s.evs[5].r === s.evs[4].id);
  await asAdmin();
  r = await cancel(tx, v.id);
  ok('cancel again → already_cancelled, nothing written', r.ok && r.rows[0].r.status === 'already_cancelled');
  ok('editing a cancelled voucher → voucher_cancelled', code(await edit(tx, v)) === 'voucher_cancelled');

  console.log('Existing voucher (posted by the old path) and a voucher with no journal event');
  await tx.asOwner();
  const old = (await tx.query(`select v.* from public.vouchers v where v.society_id::text = $1 and not coalesce(v."isDeleted", false) and coalesce(v.origin, '') <> 'engine'
      and coalesce(v."approvalStatus", '') <> 'pending' and v."reversedBy" is null and substr(v.date, 1, 10)::date >= $2::date
      and exists (select 1 from public.ledger_events e where e.aggregate_id = v.id and e.event_type = 'voucher.posted')
      and not exists (select 1 from public.ledger_events e where e.aggregate_id = v.id and e.event_type <> 'voucher.posted') limit 1`, [sid, fy_start])).rows[0];
  if (old) {
    await asAdmin();
    const ov = { ...old, narration: (old.narration ?? '') + ' (edit)', amount: Number(old.amount) + 1, lines: null, debitAccountId: old.debitAccountId || getVoucherLines(old).find((l) => l.type === 'Dr')?.accountId,
      creditAccountId: old.creditAccountId || getVoucherLines(old).find((l) => l.type === 'Cr')?.accountId };
    r = await edit(tx, ov);
    await tx.asOwner();
    s = await state(tx, ov.id);
    ok(`existing voucher ${old.voucherNo}: edit → reversed + reposted, consistent`, r.ok && s.evs.length === 3 && consistent(s, netOf(ov)), `${code(r)} ${show(s)}`);
  } else ok('(no existing voucher in the open FY to edit — skipped)', true);
  const bare = mk();
  await tx.query(`insert into public.vouchers (id, society_id, "voucherNo", date, type, "debitAccountId", "creditAccountId", amount, narration, "isDeleted", "createdAt", "createdBy", origin)
    values ($1, $2, $3, $4, 'journal', '5301', '3301', 100, 'no journal', false, now(), 'Harness', 'manual')`, [bare.id, sid, bare.voucherNo, d]);
  await asAdmin();
  const bv = { ...bare, amount: 60 };
  r = await edit(tx, bv);
  await tx.asOwner();
  s = await state(tx, bare.id);
  ok('voucher with no journal event: edit → one late voucher.posted, consistent', r.ok && s.evs.map((e) => e.t).join() === 'voucher.posted' && consistent(s, netOf(bv)), `${code(r)} ${show(s)}`);
  const bare2 = mk();
  await tx.query(`insert into public.vouchers (id, society_id, "voucherNo", date, type, "debitAccountId", "creditAccountId", amount, narration, "isDeleted", "createdAt", "createdBy", origin)
    values ($1, $2, $3, $4, 'journal', '5301', '3301', 100, 'no journal', false, now(), 'Harness', 'manual')`, [bare2.id, sid, bare2.voucherNo, d]);
  await tx.query(`insert into public.voucher_entries (id, "voucherId", "accountId", dr, cr, society_id) values ($1 || '-x', $1, '5301', 100, 0, $2)`, [bare2.id, sid]);
  await asAdmin();
  r = await cancel(tx, bare2.id);
  await tx.asOwner();
  s = await state(tx, bare2.id);
  ok('cancel of a voucher with no journal posting → no event, stale entries removed', r.ok && s.evs.length === 0 && consistent(s, {}) && s.row.del === true, `${code(r)} ${show(s)}`);

  console.log('Refusals');
  const fresh = async () => { await asAdmin(); const x = mk(); await post(tx, x, sid); return x; };
  const x1 = await fresh();
  await tx.as({ email: 's3d-viewer@harness.test', user_role: 'viewer' });
  ok('viewer cannot edit → role_cannot_write', code(await edit(tx, { ...x1, amount: 5 })) === 'role_cannot_write');
  await tx.as({ email: 's3d-acct@harness.test', user_role: 'accountant' });
  ok('accountant can edit', (await edit(tx, { ...x1, narration: 'acct' })).ok);
  ok('accountant cannot cancel → role_cannot_delete', code(await cancel(tx, x1.id)) === 'role_cannot_delete');
  await tx.as({ email: 's3d-admin@harness.test' });
  ok('no role claim → no_role_claim', code(await edit(tx, x1)) === 'no_role_claim');
  await asAdmin();
  const unbal = await tx.attempt('select public.edit_voucher($1::jsonb, $2::jsonb, $3) as r', [JSON.stringify({ ...x1, amount: 100 }),
    JSON.stringify([{ id: 'a', accountId: '5301', drCr: 'Dr', amountMinor: 10000 }, { id: 'b', accountId: '3301', drCr: 'Cr', amountMinor: 9999 }]), 'H']);
  ok('unbalanced legs → unbalanced', code(unbal) === 'unbalanced');
  ok('legs not matching the voucher total → legs_do_not_match_voucher', code(await tx.attempt('select public.edit_voucher($1::jsonb, $2::jsonb, $3) as r', [JSON.stringify({ ...x1, amount: 100 }),
    JSON.stringify([{ id: 'a', accountId: '5301', drCr: 'Dr', amountMinor: 5000 }, { id: 'b', accountId: '3301', drCr: 'Cr', amountMinor: 5000 }]), 'H'])) === 'legs_do_not_match_voucher');
  ok('moving the date out of the open FY → no_open_fy_for_date', ['no_open_fy_for_date', 'period_locked'].includes(code(await edit(tx, { ...x1, date: `${Number(fy_start.slice(0, 4)) - 1}-06-01` }))));
  ok('an unknown / other society\'s voucher id → voucher_not_found', code(await cancel(tx, randomUUID())) === 'voucher_not_found');
  await tx.asOwner();
  await tx.query(`update public.vouchers set origin = 'engine' where id = $1`, [x1.id]);
  await asAdmin();
  ok('engine voucher: edit and cancel refused', code(await edit(tx, x1)) === 'engine_voucher' && code(await cancel(tx, x1.id)) === 'engine_voucher');
  const x2 = await fresh();
  await tx.asOwner();
  await tx.query(`update public.vouchers set "reversedBy" = 'someone' where id = $1`, [x2.id]);
  await asAdmin();
  ok('reversed voucher: edit and cancel refused', code(await edit(tx, x2)) === 'voucher_reversed' && code(await cancel(tx, x2.id)) === 'voucher_reversed');
  const x3 = await fresh();
  await tx.asOwner();
  await tx.query(`update public.society_settings set "periodLockDate" = $2 where society_id::text = $1`, [sid, d]);
  await asAdmin();
  ok('voucher inside the locked period: edit and cancel refused', code(await edit(tx, x3)) === 'period_locked' && code(await cancel(tx, x3.id)) === 'period_locked');
  await tx.asOwner();
  await tx.query(`update public.society_settings set "periodLockDate" = null, "fyLocked" = true where society_id::text = $1`, [sid]);
  await asAdmin();
  ok('FY-locked society: edit and cancel refused', code(await edit(tx, x3)) === 'fy_locked' && code(await cancel(tx, x3.id)) === 'fy_locked');
  await tx.asOwner();
  await tx.query(`update public.society_settings set "fyLocked" = false where society_id::text = $1`, [sid]);
  const closed = (await tx.query(`select v.id from public.vouchers v where v.society_id::text = $1 and not coalesce(v."isDeleted", false)
      and coalesce(v.origin, '') <> 'engine' and v."reversedBy" is null and substr(v.date, 1, 10)::date < $2::date
      and substr(v.date, 1, 10)::date > coalesce((select substr("periodLockDate", 1, 10)::date from public.society_settings where society_id::text = $1), '1900-01-01') limit 1`, [sid, fy_start])).rows[0];
  if (closed) { await asAdmin(); ok('a voucher in a closed FY → voucher_in_closed_fy', code(await cancel(tx, closed.id)) === 'voucher_in_closed_fy'); }
  else ok('(no closed-FY voucher after the period lock — skipped)', true);
  await tx.asAnon();
  ok('anon cannot call either', !(await cancel(tx, x3.id)).ok);
});

console.log(`\nS3-d edit/cancel: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
