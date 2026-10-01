#!/usr/bin/env node
// Phase-2 A5 · migration 087: an anon re-issue can no longer rename a certificate's holder.
// Run: node scripts/db-harness/tests/a5-issue-certificate.mjs   (harness up; everything rolled back)

import { inRollback } from '../lib.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); } };

await inRollback(async (tx) => {
  const issue = (no, name, email, soc, parts) => tx.attempt('select public.issue_certificate($1, $2, $3, $4, $5)', [no, name, email, soc, parts]);
  const verify = async (no, name) => (await tx.query('select count(*)::int n from public.verify_certificate($1, $2)', [no, name])).rows[0].n === 1;
  await tx.asAnon();
  ok('anon records a new certificate', (await issue('SL-20260930-A5TEST', 'Ram Kumar', 'ram@x.in', 'Soc A', 2)).ok);
  ok('the holder verifies', await verify('SL-20260930-A5TEST', 'ram kumar'));
  ok('a re-issue under another name is accepted but changes nothing', (await issue('SL-20260930-A5TEST', 'Mallory', 'evil@x.in', 'Evil Soc', 9)).ok);
  ok('… the real holder still verifies', await verify('SL-20260930-A5TEST', 'Ram Kumar'));
  ok('… and the forger does not', !(await verify('SL-20260930-A5TEST', 'Mallory')));
  await tx.asOwner();
  const row = (await tx.query(`select email, society_name, parts_passed from public.guide_certificates where cert_no = 'SL-20260930-A5TEST'`)).rows[0];
  ok('email / society / parts untouched by the forger', row.email === 'ram@x.in' && row.society_name === 'Soc A' && row.parts_passed === 2, JSON.stringify(row));
  await tx.asAnon();
  await issue('SL-20260930-A5TEST', '  ram   KUMAR ', null, null, 4);
  await tx.asOwner();
  ok('the same holder (any spacing/case) can raise parts_passed', (await tx.query(`select parts_passed p from public.guide_certificates where cert_no = 'SL-20260930-A5TEST'`)).rows[0].p === 4);
});
console.log(`\nA5 issue_certificate (087): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
