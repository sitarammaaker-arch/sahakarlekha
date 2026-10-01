#!/usr/bin/env node
// Phase-2 C2–C4 · migration 091 close_financial_year on the restored backup (founder D1–D4), on a real
// trading society: roll over (090), then close the 'closing' year with a board-resolution reference and a
// closing-stock value. Verifies the guards, the two server vouchers, opening = closing, the surplus in
// 1208, unchanged balance-sheet balances, books still agreeing, and the closed year refusing posts.
// Precondition: harness up with 088 + 090 + 091 applied. Everything runs in one rolled-back transaction.
//
// Run: node scripts/db-harness/tests/c2-close-fy.mjs

import { randomUUID } from 'node:crypto';
import { inRollback } from '../lib.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); } };
const code = (r) => (r.ok ? 'OK' : (r.error.message.match(/close_fy:([a-z_]+)/) || r.error.message.match(/post_voucher:([a-z_]+)/) || [null, r.error.message])[1]);

await inRollback(async (tx) => {
  // A trading society on 2026-27 with the 1208 / 3403 / 5150 accounts and the most vouchers.
  const [{ sid }] = (await tx.query(`select f.society_id sid from public.financial_years f
     where f.status = 'open' and f.fy_label = '2026-27' and f.society_id like $1
       and (select count(*) from public.accounts a where a.society_id::text = f.society_id and a.id in ('1208', '3403', '5150')) = 3
     order by (select count(*) from public.vouchers v where v.society_id::text = f.society_id and not coalesce(v."isDeleted", false)) desc limit 1`, [(process.env.C2_SOCIETY || '') + '%'])).rows;   // C2_SOCIETY=<id prefix> to pick one
  ok('fixture: a 2026-27 society with 1208 / 3403 / 5150', !!sid);
  const A = 'c2-admin@harness.test', V = 'c2-viewer@harness.test';
  await tx.query(`insert into public.society_users (id, society_id, email, role, name, is_active) values (gen_random_uuid(), $1, $2, 'admin', 'C2 Admin', true), (gen_random_uuid(), $1, $3, 'accountant', 'C2 Acc', true)`, [sid, A, V]);
  const asA = () => tx.as({ email: A, user_role: 'admin', sub: randomUUID() });
  const close = async (label, auth, stock = null, as = asA) => { await as(); return tx.attempt('select public.close_financial_year($1, $2, $3) as r', [label, auth, stock]); };
  const bal = async (asOf) => { await tx.asOwner(); return Object.fromEntries((await tx.query('select account_id, net from public._fy_balances($1, $2)', [sid, asOf])).rows.map((r) => [r.account_id, Number(r.net)])); };
  const accType = Object.fromEntries((await tx.query(`select id, type from public.accounts where society_id::text = $1 and not coalesce("isGroup", false)`, [sid])).rows.map((r) => [r.id, r.type]));
  const stockIds = (await tx.query(`select id from public.accounts where society_id::text = $1 and not coalesce("isGroup", false) and (id = '3400' or "parentId" = '3400')`, [sid])).rows.map((r) => r.id);

  console.log('Guards before the year is closing');
  ok('an OPEN year cannot be closed', code(await close('2026-27', 'Board res. 12 dt 10-04-2027')) === 'not_closing');

  // Roll over (090) — 2026-27 becomes closing.
  await asA();
  ok('rollover to 2027-28 succeeds', (await tx.attempt(`update public.society_settings set "financialYear" = '2027-28' where society_id::text = $1`, [sid])).ok);

  console.log('Guards on the closing year');
  ok('no authority → refused', code(await close('2026-27', '  ')) === 'authority_required');
  ok('a non-admin is refused', code(await close('2026-27', 'Board res. 12 dt 10-04-2027', null, () => tx.as({ email: V, user_role: 'accountant' }))) === 'admin_only');
  await tx.asAnon();
  ok('anon cannot execute', !(await tx.attempt('select public.close_financial_year($1, $2, null) as r', ['2026-27', 'x x x x x'])).ok);
  await tx.asOwner();
  const pendId = randomUUID();
  await tx.query(`insert into public.vouchers (id, society_id, "voucherNo", type, date, "debitAccountId", "creditAccountId", amount, narration, "approvalStatus") values ($1, $2, 'JV/C2/PEND', 'journal', '2026-08-01', '1208', '1208', 1, 'c2 pending', 'pending')`, [pendId, sid]);
  ok('a pending voucher in the year → refused', code(await close('2026-27', 'Board res. 12 dt 10-04-2027')) === 'pending_vouchers');
  await tx.asOwner(); await tx.query('delete from public.vouchers where id = $1', [pendId]);

  console.log('Close');
  const before = await bal('2027-03-31');
  const stockNow = stockIds.reduce((s, id) => s + (before[id] || 0), 0);
  const closingStock = stockNow + 250000;   // ₹2,500 more stock at the count than the ledger holds
  const expectSurplus = -Object.entries(before).filter(([id]) => ['income', 'expense'].includes(accType[id])).reduce((s, [, n]) => s + n, 0) + 250000;
  const r = await close('2026-27', 'Board resolution 12 dated 10-04-2027', closingStock);
  ok('close succeeds', r.ok && r.rows[0].r.status === 'closed', r.ok ? '' : r.error.message);
  const res = r.ok ? r.rows[0].r : {};
  ok('net result = income − expense + stock increase', Number(res.netResultMinor) === expectSurplus, `${res.netResultMinor} vs ${expectSurplus}`);
  ok('stock change posted = closing − ledger', Number(res.stockDeltaMinor) === 250000);

  await tx.asOwner();
  const fy = (await tx.query(`select status, close_authority, net_result_minor, opening_event_id from public.financial_years where society_id = $1 and fy_label = '2026-27'`, [sid])).rows[0];
  ok('2026-27 is closed with the authority, result and opening event recorded', fy.status === 'closed' && /Board resolution 12/.test(fy.close_authority) && Number(fy.net_result_minor) === expectSurplus && !!fy.opening_event_id, JSON.stringify(fy));
  const vs = (await tx.query(`select "voucherNo" no, date, "refType" ref, (select count(*) from public.voucher_lines l where l.voucher_id = v.id and l.status = 'posted')::int lines,
      (select count(*) from public.voucher_entries e where e."voucherId" = v.id)::int ents, (select count(*) from public.ledger_events x where x.aggregate_id = v.id)::int evs
      from public.vouchers v where v.society_id::text = $1 and v."refType" in ('fy.close', 'fy.close.stock') order by date`, [sid])).rows;
  ok('two server vouchers: stock on 31-03-2027, result on 01-04-2027', vs.length === 2 && vs[0].ref === 'fy.close.stock' && vs[0].date === '2026-03-31'.replace('2026', '2027') && vs[1].ref === 'fy.close' && vs[1].date === '2027-04-01', JSON.stringify(vs.map((x) => [x.no, x.date, x.ref])));
  ok('each written four ways (row + lines + entries + journal)', vs.every((x) => x.lines >= 2 && x.ents >= 2 && x.evs === 1));

  console.log('Opening = closing');
  const atEnd = await bal('2027-03-31');
  const atOpen = await bal('2027-04-01');
  const nomOpen = Object.entries(atOpen).filter(([id, n]) => ['income', 'expense'].includes(accType[id]) && n !== 0);
  ok('every income / expense account starts the new year at zero', nomOpen.length === 0, JSON.stringify(nomOpen.slice(0, 3)));
  ok('1208 rose by exactly the surplus', (atOpen['1208'] || 0) - (atEnd['1208'] || 0) === -expectSurplus);
  const realDiff = Object.keys({ ...atEnd, ...atOpen }).filter((id) => !['income', 'expense'].includes(accType[id]) && id !== '1208' && (atEnd[id] || 0) !== (atOpen[id] || 0));
  ok('every balance-sheet account (except 1208) is identical across the close', realDiff.length === 0, realDiff.join());
  ok('the stock ledger now equals the counted closing stock', stockIds.reduce((s, id) => s + (atEnd[id] || 0), 0) === closingStock);
  ok('the whole ledger still balances', Object.values(atOpen).reduce((s, n) => s + n, 0) === Object.values(before).reduce((s, n) => s + n, 0));

  console.log('After the close');
  ok('closing it again is refused', code(await close('2026-27', 'Board resolution 12 dated 10-04-2027')) === 'not_closing');
  await asA();
  const late = await tx.attempt(`select public.post_voucher($1::jsonb, $2::jsonb, $3::jsonb)`, [
    JSON.stringify({ id: 'c2-late', voucherNo: 'JV/C2/LATE', type: 'journal', date: '2027-02-01', debitAccountId: '1208', creditAccountId: '1208', amount: 1 }),
    JSON.stringify([{ id: 'a', accountId: '1208', drCr: 'Dr', amountMinor: 100 }, { id: 'b', accountId: '1208', drCr: 'Cr', amountMinor: 100 }]),
    JSON.stringify({ event_id: 'c2-late-e', event_type: 'voucher.posted', sequence: 1, aggregate_id: 'c2-late', payload: { lines: [{ accountId: '1208', drCr: 'Dr', amountMinor: 100 }, { accountId: '1208', drCr: 'Cr', amountMinor: 100 }] } })]);
  ok('a voucher dated in the closed year is refused', code(late) === 'no_open_fy_for_date', code(late));
  await tx.asOwner();
  const audit = (await tx.query(`select count(*)::int n from public.audit_log where society_id = $1 and entity_type = 'financial_year' and action = 'close'`, [sid])).rows[0].n;
  ok('the close is in the audit log', audit === 1);
});

console.log(`\nC2 close financial year (091): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
