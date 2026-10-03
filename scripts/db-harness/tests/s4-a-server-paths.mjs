#!/usr/bin/env node
// 103 · S4-a server paths: reject_voucher, set_voucher_cleared, link_voucher_reversal, sync_account_opening_event,
// merge_accounts. Each does its job in one transaction, refuses what the app refuses, leaves no s4 note (102), and
// keeps ledger_drift at 0. Precondition: harness up (latest dump) with 102 + 103 applied. Rolled back.
//
// Run: node scripts/db-harness/tests/s4-a-server-paths.mjs

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

await inRollback(async (tx) => {
  const one = async (sql, p = []) => (await tx.query(sql, p)).rows[0];
  const notesBefore = Number((await one(`select count(*) n from public.error_log where source = 's4-direct-write'`)).n);
  await tx.query(`insert into public.society_users (id, society_id, email, role, name, is_active) values
    (gen_random_uuid(), $1, 's4a-admin@harness.test', 'admin', 'S4A Admin', true),
    (gen_random_uuid(), $1, 's4a-viewer@harness.test', 'viewer', 'S4A Viewer', true)`, [RANIA]);
  const [{ fy_start }] = (await tx.query(`select start_date::text fy_start from public.financial_years where status = 'open' and society_id = $1`, [RANIA])).rows;
  const d = fy_start.slice(0, 4) + '-06-12';
  const admin = () => tx.as({ email: 's4a-admin@harness.test', user_role: 'admin' });
  const viewer = () => tx.as({ email: 's4a-viewer@harness.test', user_role: 'viewer' });
  const mk = (over = {}) => ({ id: randomUUID(), voucherNo: 'JV/S4A/' + Math.floor(Math.random() * 1e6), type: 'journal', date: d, debitAccountId: '5301', creditAccountId: '3301',
    amount: 100, narration: 'S4-a harness', origin: 'manual', createdAt: new Date().toISOString(), createdBy: 'Harness', ...over });
  const post = async (v) => {
    const ev = buildEvent({ eventType: 'voucher.posted', tenantId: RANIA, aggregateType: 'voucher', aggregateId: v.id, sequence: 1,
      producer: { kind: 'human', id: 'Harness' }, payload: { lines: voucherPostingLines(v), ...voucherEventMeta(v) } }, { eventId: randomUUID(), occurredAt: new Date().toISOString() });
    const p = buildPostVoucherPayload(v, ev);
    return tx.attempt('select public.post_voucher($1::jsonb, $2::jsonb, $3::jsonb) as r', [JSON.stringify(p.p_voucher), JSON.stringify(p.p_lines), JSON.stringify(p.p_event)]);
  };
  const call = (sql, p) => tx.attempt(sql, p);

  /* 1 · reject_voucher */
  await tx.asOwner();
  const pend = mk();
  await tx.query(`insert into public.vouchers (id, society_id, "voucherNo", type, date, "debitAccountId", "creditAccountId", amount, narration, "approvalStatus", "createdAt", "createdBy")
                  values ($1, $2, $3, 'journal', $4, '5301', '3301', 100, 'pending', 'pending', now(), 'Someone Else')`, [pend.id, RANIA, pend.voucherNo, d]);
  await tx.query(`insert into public.voucher_entries (id, "voucherId", "accountId", dr, cr, society_id) values ($1, $2, '5301', 100, 0, $3)`, [pend.id + '-x', pend.id, RANIA]);
  await viewer();
  ok('reject: a viewer is refused', code(await call('select public.reject_voucher($1, $2, $3)', [pend.id, 'no', 'V'])) === 'role_cannot_write');
  await admin();
  const rj = await call('select public.reject_voucher($1, $2, $3) r', [pend.id, 'galat entry', 'S4A Admin']);
  ok('reject: a pending voucher is rejected', rj.ok && rj.rows[0].r.status === 'rejected', code(rj));
  ok('reject: again => already_rejected (idempotent)', (await call('select public.reject_voucher($1, $2, $3) r', [pend.id, 'x', 'S4A Admin'])).rows?.[0]?.r?.status === 'already_rejected');
  await tx.asOwner();
  const pr = await one(`select "approvalStatus" s, "approvalRemarks" rem from public.vouchers where id = $1`, [pend.id]);
  ok('reject: status + reason stored', pr.s === 'rejected' && pr.rem === 'galat entry');
  ok('reject: its voucher_entries are gone', Number((await one(`select count(*) n from public.voucher_entries where "voucherId" = $1`, [pend.id])).n) === 0);
  const live = mk();
  await admin();
  ok('fixture: a live voucher posts', (await post(live)).ok);
  ok('reject: a posted (non-pending) voucher is refused', code(await call('select public.reject_voucher($1, $2, $3)', [live.id, 'x', 'S4A Admin'])) === 'not_pending');
  ok('reject: an unknown id => not found', code(await call('select public.reject_voucher($1, $2, $3)', ['no-such-id', 'x', 'S4A Admin'])) === 'voucher_not_found');

  /* 2 · set_voucher_cleared */
  const cl = await call('select public.set_voucher_cleared($1, true, $2) r', [live.id, d]);
  ok('clear: sets isCleared + the date', cl.ok && cl.rows[0].r.clearedDate === d, code(cl));
  ok('clear: a bad date is refused', code(await call('select public.set_voucher_cleared($1, true, $2)', [live.id, '12/06/2026'])) === 'bad_date');
  const un = await call('select public.set_voucher_cleared($1, false, null) r', [live.id]);
  await tx.asOwner();
  const cr = await one(`select "isCleared" c, "clearedDate" dt from public.vouchers where id = $1`, [live.id]);
  ok('unclear: clears both columns', un.ok && cr.c === false && cr.dt === null, code(un));

  /* 3 · link_voucher_reversal */
  await admin();
  const orig = mk(), rev = mk({ debitAccountId: '3301', creditAccountId: '5301', narration: 'Reversal' }), other = mk({ amount: 999 });
  ok('fixture: original + contra + other post', (await post(orig)).ok && (await post(rev)).ok && (await post(other)).ok);
  ok('link: amounts must match', code(await call('select public.link_voucher_reversal($1, $2)', [orig.id, other.id])) === 'not_a_reversal_pair');
  const lk = await call('select public.link_voucher_reversal($1, $2) r', [orig.id, rev.id]);
  ok('link: both sides set in one call', lk.ok && lk.rows[0].r.status === 'linked', code(lk));
  ok('link: again => already_linked', (await call('select public.link_voucher_reversal($1, $2) r', [orig.id, rev.id])).rows?.[0]?.r?.status === 'already_linked');
  await tx.asOwner();
  const lnk = await one(`select (select "reversedBy" from public.vouchers where id = $1) rb, (select "reversalOf" from public.vouchers where id = $2) ro`, [orig.id, rev.id]);
  ok('link: reversedBy / reversalOf stored', lnk.rb === rev.id && lnk.ro === orig.id);
  await admin();
  const rev2 = mk({ debitAccountId: '3301', creditAccountId: '5301' });
  await post(rev2);
  ok('link: an already-reversed original is refused', code(await call('select public.link_voucher_reversal($1, $2)', [orig.id, rev2.id])) === 'voucher_reversed');

  /* 4 · sync_account_opening_event */
  await tx.asOwner();
  const acc = randomUUID();
  await tx.query(`insert into public.accounts (id, society_id, name, type, "openingBalance", "openingBalanceType", "isGroup", "parentId") values ($1, $2, 'S4A Opening', 'asset', 500, 'debit', false, '3300')`, [acc, RANIA]);
  await admin();
  const s1 = await call('select public.sync_account_opening_event($1) r', [acc]);
  const e1 = s1.ok ? s1.rows[0].r.events[0] : null;
  ok('opening: Rs 500 Dr => one account.opening event, Dr 50000', !!e1 && e1.event_type === 'account.opening' && e1.payload.lines[0].drCr === 'Dr' && e1.payload.lines[0].amountMinor === 50000, code(s1));
  ok('opening: event id / date follow planOpeningDelta', !!e1 && e1.event_id === `opening-${acc}-1` && String(e1.occurred_at).startsWith('2000-01-01'), e1 && `${e1.event_id} ${e1.occurred_at}`);
  ok('opening: again => in_sync (idempotent)', (await call('select public.sync_account_opening_event($1) r', [acc])).rows?.[0]?.r?.status === 'in_sync');
  await tx.asOwner();
  await tx.query(`update public.accounts set "openingBalance" = 200, "openingBalanceType" = 'credit' where id = $1`, [acc]);
  await admin();
  const s2 = await call('select public.sync_account_opening_event($1) r', [acc]);
  const e2 = s2.ok ? s2.rows[0].r.events[0] : null;
  ok('opening: Rs 500 Dr -> Rs 200 Cr => delta Cr 70000, new recorded', !!e2 && e2.payload.lines[0].drCr === 'Cr' && e2.payload.lines[0].amountMinor === 70000 && Number(e2.payload.newSignedMinor) === -20000);
  ok('opening: target 0 nets the journal (deleted account)', (await call('select public.sync_account_opening_event($1, 0) r', [acc])).rows?.[0]?.r?.events?.[0]?.payload?.lines?.[0]?.amountMinor === 20000);
  ok('opening: unknown account without a target => refused', code(await call('select public.sync_account_opening_event($1)', ['no-such-acct'])) === 'account_not_found');

  /* 5 · merge_accounts */
  await tx.asOwner();
  const keep = randomUUID(), rem = randomUUID();
  await tx.query(`insert into public.accounts (id, society_id, name, type, "openingBalance", "openingBalanceType", "isGroup", "parentId") values
    ($1, $3, 'S4A Keep', 'expense', 0, 'debit', false, '5300'), ($2, $3, 'S4A Remove', 'expense', 0, 'debit', false, '5300')`, [keep, rem, RANIA]);
  await admin();
  const m1 = mk({ debitAccountId: rem, amount: 250 });
  const m2 = mk({ amount: 75, debitAccountId: '3301', creditAccountId: rem });
  const m3 = mk({ debitAccountId: rem, amount: 40 });
  const p1 = await post(m1), p2 = await post(m2), p3 = await post(m3);
  ok('fixture: three vouchers on the account-to-remove post', p1.ok && p2.ok && p3.ok, [p1, p2, p3].map(code).join(' '));
  ok('fixture: one of them cancelled', (await call('select public.cancel_voucher($1, $2, $3)', [m3.id, 'x', 'Harness'])).ok);
  await viewer();
  ok('merge: a viewer is refused', code(await call('select public.merge_accounts($1, $2, $3)', [keep, rem, 'V'])) === 'role_cannot_delete');
  await admin();
  ok('merge: same account refused', code(await call('select public.merge_accounts($1, $1, $2)', [keep, 'A'])) === 'same_account');
  ok('merge: different types refused', code(await call('select public.merge_accounts($1, $2, $3)', ['3301', rem, 'A'])) === 'account_type_mismatch');
  const mg = await call('select public.merge_accounts($1, $2, $3) r', [keep, rem, 'S4A Admin']);
  ok('merge: succeeds in one call', mg.ok && mg.rows[0].r.status === 'merged', code(mg));
  ok('merge: moved 3 vouchers, journaled the 2 live ones', mg.ok && mg.rows[0].r.moved === 3 && mg.rows[0].r.journaled === 2, JSON.stringify(mg.rows?.[0]?.r));
  ok('merge: the emptied account is deleted', mg.ok && mg.rows[0].r.accountDeleted === true);
  ok('merge: returns its 4 journal events (2 reversed + 2 reposted) for the app', mg.ok && mg.rows[0].r.events.length === 4 && mg.rows[0].r.events.every((e) => ['voucher.reversed', 'voucher.reposted'].includes(e.event_type)));
  await tx.asOwner();
  ok('merge: no voucher still points at the removed account', Number((await one(`select count(*) n from public.vouchers where society_id = $1 and ("debitAccountId" = $2 or "creditAccountId" = $2)`, [RANIA, rem])).n) === 0);
  ok('merge: voucher_entries / voucher_lines re-pointed', Number((await one(`select (select count(*) from public.voucher_entries where "accountId" = $1) + (select count(*) from public.voucher_lines where account_id = $1) n`, [rem])).n) === 0);
  const evs = (await tx.query(`select event_type, payload from public.ledger_events where aggregate_id = $1 order by sequence`, [m1.id])).rows;
  ok('merge: live voucher journaled as posted -> reversed -> reposted', evs.map((e) => e.event_type).join(',') === 'voucher.posted,voucher.reversed,voucher.reposted', evs.map((e) => e.event_type).join(','));
  ok('merge: the repost carries the KEEP account', !!evs[2]?.payload?.lines?.some((l) => l.accountId === keep) && !evs[2]?.payload?.lines?.some((l) => l.accountId === rem));
  ok('merge: the cancelled voucher got no journal pair', (await tx.query(`select event_type from public.ledger_events where aggregate_id = $1 order by sequence`, [m3.id])).rows.map((e) => e.event_type).join(',') === 'voucher.posted,voucher.cancelled');
  ok('merge: audit row written', Number((await one(`select count(*) n from public.audit_log where entity_id = $1 and action = 'merge'`, [rem])).n) === 1);

  /* 7 · save_pending_voucher (104) — a maker-checker voucher created and edited through the server */
  const legs = (v) => [
    { id: 'a', accountId: v.debitAccountId, drCr: 'Dr', amountMinor: Math.round(v.amount * 100), narration: null },
    { id: 'b', accountId: v.creditAccountId, drCr: 'Cr', amountMinor: Math.round(v.amount * 100), narration: null },
  ];
  const pv = mk({ approvalStatus: 'pending', amount: 300, createdBy: 'Maker Person', voucherNo: 'JV/2026/27/001' });
  await viewer();
  ok('pending: a viewer is refused', code(await call('select public.save_pending_voucher($1::jsonb, $2::jsonb)', [JSON.stringify(pv), JSON.stringify(legs(pv))])) === 'role_cannot_write');
  await admin();
  ok('pending: a NON-pending voucher is refused (use post_voucher)', code(await call('select public.save_pending_voucher($1::jsonb, $2::jsonb)', [JSON.stringify({ ...pv, id: randomUUID(), approvalStatus: undefined }), JSON.stringify(legs(pv))])) === 'not_pending');
  ok('pending: unbalanced legs refused', code(await call('select public.save_pending_voucher($1::jsonb, $2::jsonb)', [JSON.stringify(pv), JSON.stringify([legs(pv)[0], { ...legs(pv)[1], amountMinor: 1 }])])) === 'unbalanced');
  const sp = await call('select public.save_pending_voucher($1::jsonb, $2::jsonb) r', [JSON.stringify(pv), JSON.stringify(legs(pv))]);
  ok('pending: saved, with a server-issued number', sp.ok && sp.rows[0].r.status === 'saved' && !!sp.rows[0].r.voucherNo, code(sp));
  await tx.asOwner();
  const pRow = await one(`select "approvalStatus" s, amount::numeric a, (select count(*) from public.voucher_entries where "voucherId" = $1) ne,
    (select count(*) from public.voucher_lines where voucher_id = $1) nl, (select count(*) from public.ledger_events where aggregate_id = $1) nev from public.vouchers where id = $1`, [pv.id]);
  ok('pending: row is pending with NO lines / entries / journal event', pRow.s === 'pending' && Number(pRow.ne) === 0 && Number(pRow.nl) === 0 && Number(pRow.nev) === 0, JSON.stringify(pRow));
  await admin();
  const pv2 = { ...pv, amount: 350, narration: 'edited while pending' };
  const ed = await call('select public.save_pending_voucher($1::jsonb, $2::jsonb) r', [JSON.stringify(pv2), JSON.stringify(legs(pv2))]);
  ok('pending: an edit of the same id updates it', ed.ok && ed.rows[0].r.status === 'updated', code(ed));
  await tx.asOwner();
  ok('pending: the edit landed (amount 350)', Number((await one(`select amount::numeric a from public.vouchers where id = $1`, [pv.id])).a) === 350);
  await admin();
  const ap = await call('select public.approve_voucher($1, $2::jsonb, $3) r', [pv.id, JSON.stringify(legs(pv2)), 'S4A Admin']);
  ok('pending → approve_voucher posts it (maker ≠ checker)', ap.ok && ap.rows[0].r.status === 'approved', code(ap));
  ok('pending: once approved, save_pending_voucher refuses it', code(await call('select public.save_pending_voucher($1::jsonb, $2::jsonb)', [JSON.stringify(pv2), JSON.stringify(legs(pv2))])) === 'not_pending');

  /* 6 · invariants */
  await tx.asOwner();
  const drift = (await tx.query(`select * from public.ledger_drift($1)`, [RANIA])).rows;
  ok('drift: ledger_drift for the society stays 0', drift.length === 0, JSON.stringify(drift));
  ok('S4-0: none of these server paths left an s4 note', Number((await one(`select count(*) n from public.error_log where source = 's4-direct-write'`)).n) === notesBefore);
  await tx.asAnon();
  ok('anon cannot call merge_accounts', (await call('select public.merge_accounts($1, $2, $3)', [keep, rem, 'x'])).error?.code === '42501');
});

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
