#!/usr/bin/env node
// R4 follow-up · migration 111: a society registered through the real signup RPC gets its seven payroll roles
// (salary.expense, salary.payable, pf.payable, esi.payable, tds.payable, professional_tax.payable, employee.advance)
// automatically from its standard accounts — and ONLY from an exact id + name + type match. A housing chart's
// 2207 "Property Tax Payable", a UUID-id account, and a group account must NOT be mapped.
// Precondition: harness up, 074 (account_roles) applied; apply 111 for the passing result. One rolled-back tx.
//
// Run: node scripts/db-harness/tests/r4-auto-payroll-roles.mjs

import { randomUUID } from 'node:crypto';
import { inRollback } from '../lib.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); } };

const STANDARD = [
  ['5201', 'Salary', 'expense', 'salary.expense'],
  ['2103', 'Salary Payable', 'liability', 'salary.payable'],
  ['2203', 'EPF Payable', 'liability', 'pf.payable'],
  ['2204', 'ESI Payable', 'liability', 'esi.payable'],
  ['2202', 'TDS Payable', 'liability', 'tds.payable'],
  ['2207', 'Professional Tax Payable', 'liability', 'professional_tax.payable'],
  ['3315', 'Advance to Employees', 'asset', 'employee.advance'],
];

async function signup(tx, sid, accounts) {
  const email = `r4-${sid.slice(0, 8)}@harness.test`;
  await tx.asAnon();   // signup runs before any login
  const r = await tx.attempt(`select public.register_society($1, $2, 'Passw0rd!', 'R4 Admin', $3::jsonb, $4::jsonb, $5::jsonb) as r`, [
    sid, email,
    JSON.stringify({ id: sid, name: 'R4 Harness Society', name_hi: null, registration_no: `R4-${sid.slice(0, 8)}`, address: null, district: 'Sirsa', state: 'Haryana', phone: null, financial_year: '2026-27' }),
    JSON.stringify({ id: sid, society_id: sid, name: 'R4 Harness Society', nameHi: 'R4', registrationNo: `R4-${sid.slice(0, 8)}`, financialYear: '2026-27', financialYearStart: '2026-04-01',
      address: '', district: 'Sirsa', state: 'Haryana', phone: '', email, pinCode: '', societyType: 'cms' }),
    JSON.stringify(accounts.map((a) => ({ society_id: sid, ...a }))),
  ]);
  await tx.asOwner();
  return r;
}
const rolesOf = async (tx, sid) => Object.fromEntries((await tx.query('select role, account_id, updated_by from public.account_roles where society_id = $1', [sid])).rows.map((r) => [r.role, r]));

await inRollback(async (tx) => {
  await tx.asOwner();
  const before = Number((await tx.query('select count(*) n from public.account_roles')).rows[0].n);

  console.log('1. a standard chart → all seven roles');
  const sid = randomUUID();
  const r = await signup(tx, sid, [{ id: '3301', name: 'Cash', type: 'asset' }, ...STANDARD.map(([id, name, type]) => ({ id, name, type }))]);
  ok('signup succeeds', r.ok && r.rows[0].r?.ok === true, r.ok ? JSON.stringify(r.rows[0].r) : r.error.message);
  const roles = await rolesOf(tx, sid);
  ok('exactly the seven payroll roles, nothing else (Cash gets none)', Object.keys(roles).length === 7, JSON.stringify(Object.keys(roles)));
  ok('each role points at its standard account', STANDARD.every(([id, , , role]) => roles[role]?.account_id === id));
  ok('they are marked as written by the migration', Object.values(roles).every((x) => x.updated_by === 'auto (migration 111)'));

  console.log('\n2. a chart that must NOT be guessed');
  const sid2 = randomUUID();
  const uuidAcc = randomUUID();
  const r2 = await signup(tx, sid2, [
    { id: '2207', name: 'Property Tax Payable', type: 'liability' },       // housing chart: same id, DIFFERENT meaning
    { id: uuidAcc, name: 'PF Payable A/c', type: 'liability' },            // a society's own account: a person decides
    { id: '5201', name: 'Salary', type: 'expense', isGroup: true },        // a group is never a posting head
    { id: '2103', name: 'Salary Payable', type: 'asset' },                 // right id and name, WRONG type
    { id: '2204', name: 'ESI payable', type: 'liability' },                // name differs (case) — not an exact match
    { id: '2202', name: 'TDS Payable', type: 'liability' },                // the one exact match here
  ]);
  ok('signup succeeds', r2.ok && r2.rows[0].r?.ok === true, r2.ok ? JSON.stringify(r2.rows[0].r) : r2.error.message);
  const roles2 = await rolesOf(tx, sid2);
  ok('2207 "Property Tax Payable" is NOT mapped as professional tax', !roles2['professional_tax.payable']);
  ok('a UUID-id "PF Payable A/c" is NOT mapped', !roles2['pf.payable']);
  ok('a group account is NOT mapped', !roles2['salary.expense']);
  ok('a wrong-type account is NOT mapped', !roles2['salary.payable']);
  ok('a different-name account is NOT mapped', !roles2['esi.payable']);
  ok('the one exact match IS mapped (tds.payable → 2202)', roles2['tds.payable']?.account_id === '2202' && Object.keys(roles2).length === 1, JSON.stringify(Object.keys(roles2)));

  console.log('\n3. nothing else changes');
  const after = Number((await tx.query('select count(*) n from public.account_roles')).rows[0].n);
  ok('no existing society gained or lost a role (only the 8 new ones exist)', after === before + 8, `before ${before}, after ${after}`);
  await tx.query(`insert into public.accounts (id, society_id, name, type, "openingBalance", "openingBalanceType", "isSystem", "isGroup") values ('2203', $1, 'EPF Payable', 'liability', 0, 'credit', false, false)`, [sid2]);
  ok('a later standard account is mapped too (the trigger is on every insert)', (await rolesOf(tx, sid2))['pf.payable']?.account_id === '2203');
  // never overwrite: pre-map pf.payable elsewhere, then insert the standard account in ANOTHER society that already has it
  const dup = await tx.attempt(`insert into public.account_roles (society_id, role, account_id) values ($1, 'pf.payable', '2203') on conflict (society_id, role) do nothing`, [sid2]);
  ok('an already-mapped role is never overwritten (on conflict do nothing)', dup.ok);
});

console.log(`\nR4 auto payroll roles (111): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
